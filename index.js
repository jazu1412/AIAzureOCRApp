'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const { promisify } = require('util');
const ComputerVisionClient = require('@azure/cognitiveservices-computervision').ComputerVisionClient;
const ApiKeyCredentials = require('@azure/ms-rest-js').ApiKeyCredentials;

// Load environment variables
require('dotenv').config();

const app = express();
const port = 3000;

// Set up multer for handling file uploads
const upload = multer({ dest: 'uploads/' });

const key = process.env.VISION_KEY;
const endpoint = process.env.VISION_ENDPOINT;

const computerVisionClient = new ComputerVisionClient(
    new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } }),
    endpoint
);

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle image file upload and OCR
app.post('/upload', upload.single('imageFile'), async (req, res) => {
    const imageFilePath = req.file.path;
    try {
        const printedResult = await readTextFromImage(computerVisionClient, imageFilePath);
        const recognizedText = extractText(printedResult);

        // Remove the file after processing
        fs.unlinkSync(imageFilePath);

        res.json({ text: recognizedText });
    } catch (error) {
        console.error('Error processing the image:', error);
        res.status(500).json({ error: 'Error processing the image.' });
    }
});

// async function readTextFromImage(client, imagePath) {
//   const imageStream = fs.createReadStream(imagePath); // Ensure it's a proper ReadableStream
//   let result = await client.readInStream(imageStream); // Pass the stream directly
//   let operation = result.operationLocation.split('/').slice(-1)[0];
//   let readResults;

//   // Polling for OCR results
//   while (!readResults || readResults.status !== 'succeeded') {
//       console.log('Waiting for OCR to complete...');
//       await new Promise(resolve => setTimeout(resolve, 1000));
//       readResults = await client.getReadResult(operation);
//       console.log('OCR status:', readResults.status);
//   }

//   return readResults.analyzeResult.readResults;
// }

// async function readTextFromImage(client, imagePath) {
//   const imageStream = fs.createReadStream(imagePath); // Ensure it's a proper ReadableStream

//   // Call the analyze method using the stream
//   const result = await client.readInStream(imageStream);
//   const operationLocation = result.operationLocation;
//   const operationId = operationLocation.substring(operationLocation.lastIndexOf('/') + 1);

//   // Poll for the OCR result status
//   let readResults;
//   while (!readResults || readResults.status !== 'succeeded') {
//       console.log('Waiting for OCR to complete...');
//       await new Promise(resolve => setTimeout(resolve, 1000));
//       readResults = await client.getReadResult(operationId);
//       console.log('OCR status:', readResults.status);
//   }

//   return readResults.analyzeResult.readResults;
// }


async function readTextFromImage(client, imagePath) {
  // Read the image file into a buffer
  const imageBuffer = fs.readFileSync(imagePath);

  // Call the read API for file content (buffer) instead of stream
  const result = await client.readInStream(imageBuffer);

  // Extract the operation ID from the operation location URL
  const operationId = result.operationLocation.split('/').pop();

  // Poll for the OCR result status
  let readResults;
  while (!readResults || readResults.status !== 'succeeded') {
      console.log('Waiting for OCR to complete...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      readResults = await client.getReadResult(operationId);
  }

  return readResults.analyzeResult.readResults;
}




// Extract text from the read results
function extractText(readResults) {
    let resultText = '';
    for (const page of readResults) {
        for (const line of page.lines) {
            resultText += line.words.map(w => w.text).join(' ') + '\n';
        }
    }
    return resultText || 'No recognized text.';
}

// Start the Express server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
