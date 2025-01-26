// src/services/pscService.js
import Papa from 'papaparse';

export const fetchPSCData = async () => {
  try {
    const response = await fetch('/data/PSC consolidated1.csv');
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        complete: (results) => {
          resolve(results.data.filter(row => Object.keys(row).length > 1)); // Filter out empty rows
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('Error fetching PSC data:', error);
    throw error;
  }
};
