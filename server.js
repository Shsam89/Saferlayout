const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const mysql = require('mysql2');
const path = require('path');
const port = process.env.PORT || 3000;
const app = express();
require('dotenv').config();
// Middleware to handle form submissions
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the frontend directory
app.use(express.static(__dirname));

// MySQL configuration
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
  });
  

// Connect to MySQL database
db.connect((err) => {
  if (err) {
    console.error('MySQL connection failed:', err);
    return;
  }
  console.log('MySQL Connected...');
});

// Function to sanitize strings (removes unwanted characters)
const sanitizeString = (str) => str ? str.replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/&nbsp;/g, ' ').trim() : '';

// Route to display the form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Serve the HTML form
});

// Handle form submission
app.post('/search', (req, res) => {
    const mcMxNumber = req.body.mcMxNumber;
  
    let data = new URLSearchParams({
      'searchtype': 'ANY',
      'query_type': 'queryCarrierSnapshot',
      'query_param': 'MC_MX',
      'query_string': mcMxNumber
    });
  
    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://safer.fmcsa.dot.gov/query.asp',
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
      },
      data: data.toString()
    };
  
    axios(config)
      .then((response) => {
        const $ = cheerio.load(response.data);
  
        const carrierData = {
          entityType: sanitizeString($('th:contains("Entity Type:")').next('td').text()) || null,
          usdotStatus: sanitizeString($('th:contains("USDOT Status:")').next('td').text()) || null,
          outOfServiceDate: sanitizeString($('th:contains("Out of Service Date:")').next('td').text()) || null,
          usdotNumber: sanitizeString($('th:contains("USDOT Number:")').next('td').text()) || null,
          stateCarrierId: sanitizeString($('th:contains("State Carrier ID Number:")').next('td').text()) || null,
          mcs150FormDate: sanitizeString($('th:contains("MCS-150 Form Date:")').next('td').text()) || null,
          mcs150MileageYear: sanitizeString($('th:contains("MCS-150 Mileage (Year):")').next('td').text()) || null,
          operatingAuthorityStatus: sanitizeString($('th:contains("Operating Authority Status:")').next('td').text()) || null,
          mcMxFfNumber: sanitizeString($('th:contains("MC/MX/FF Number(s):")').next('td').text()) || null,
          legalName: sanitizeString($('th:contains("Legal Name:")').next('td').text()) || null,
          dbaName: sanitizeString($('th:contains("DBA Name:")').next('td').text()) || null,
          physicalAddress: sanitizeString($('th:contains("Physical Address:")').next('td').html().replace(/<br>/g, ', ')) || null,
          phone: sanitizeString($('th:contains("Phone:")').next('td').text()) || null,
          mailingAddress: sanitizeString($('th:contains("Mailing Address:")').next('td').html().replace(/<br>/g, ', ')) || null,
          dunsNumber: sanitizeString($('th:contains("DUNS Number:")').next('td').text()) || null,
          powerUnits: sanitizeString($('th:contains("Power Units:")').next('td').text()) || null,
          drivers: sanitizeString($('th:contains("Drivers:")').next('td').text()) || null,
        };
  
        // Step 1: Check if the MC/MX number already exists
        const checkQuery = `
          SELECT COUNT(*) AS count FROM Carrier WHERE MCMXFFNumber = ?
        `;
  
        db.query(checkQuery, [carrierData.mcMxFfNumber], (err, result) => {
          if (err) {
            console.error('Error checking MC/MX number:', err);
            res.send('Error checking database');
            return;
          }
  
          const exists = result[0].count > 0;
  
          // Prepare HTML table
          let htmlTable = `
            <table border="1">
              <tr><th>Entity Type</th><td>${carrierData.entityType}</td></tr>
              <tr><th>USDOT Status</th><td>${carrierData.usdotStatus}</td></tr>
              <tr><th>Out of Service Date</th><td>${carrierData.outOfServiceDate}</td></tr>
              <tr><th>USDOT Number</th><td>${carrierData.usdotNumber}</td></tr>
              <tr><th>State Carrier ID Number</th><td>${carrierData.stateCarrierId}</td></tr>
              <tr><th>MCS-150 Form Date</th><td>${carrierData.mcs150FormDate}</td></tr>
              <tr><th>MCS-150 Mileage (Year)</th><td>${carrierData.mcs150MileageYear}</td></tr>
              <tr><th>Operating Authority Status</th><td>${carrierData.operatingAuthorityStatus}</td></tr>
              <tr><th>MC/MX/FF Number(s)</th><td>${carrierData.mcMxFfNumber}</td></tr>
              <tr><th>Legal Name</th><td>${carrierData.legalName}</td></tr>
              <tr><th>DBA Name</th><td>${carrierData.dbaName}</td></tr>
              <tr><th>Physical Address</th><td>${carrierData.physicalAddress}</td></tr>
              <tr><th>Phone</th><td>${carrierData.phone}</td></tr>
              <tr><th>Mailing Address</th><td>${carrierData.mailingAddress}</td></tr>
              <tr><th>DUNS Number</th><td>${carrierData.dunsNumber}</td></tr>
              <tr><th>Power Units</th><td>${carrierData.powerUnits}</td></tr>
              <tr><th>Drivers</th><td>${carrierData.drivers}</td></tr>
            </table>
          `;
  
          if (!exists) {
            // Step 2: Insert if not exists
           // Updated insert query with the correct number of columns and values
const insertQuery = `
INSERT INTO Carrier (
    EntityType, USDOTStatus, OutOfServiceDate, USDOTNumber, StateCarrierId, MCS150FormDate, 
    MCS150MileageYear, OperatingAuthorityStatus, MCMXFFNumber, LegalName, DBAName, PhysicalAddress, 
    Phone, MailingAddress, DUNSNumber, PowerUnits, Drivers
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const values = [
carrierData.entityType, carrierData.usdotStatus, carrierData.outOfServiceDate, carrierData.usdotNumber,
carrierData.stateCarrierId, carrierData.mcs150FormDate, carrierData.mcs150MileageYear,
carrierData.operatingAuthorityStatus, carrierData.mcMxFfNumber, carrierData.legalName,
carrierData.dbaName, carrierData.physicalAddress, carrierData.phone,
carrierData.mailingAddress, carrierData.dunsNumber, carrierData.powerUnits, carrierData.drivers
];

            db.query(insertQuery, values, (err, result) => {
              if (err) {
                console.error('Error inserting data:', err);
                return res.status(500).send('Error inserting data into database'); // Send error response
              }
  
              console.log('Data inserted into the database');
              res.send(htmlTable); // Send response only after successful insert
            });
          } else {
            console.log('MC/MX number already exists in the database');
            res.send(htmlTable); // Send response if data already exists
          }
        });
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        res.send('Error fetching data from the carrier API');
      });
  });
  

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
