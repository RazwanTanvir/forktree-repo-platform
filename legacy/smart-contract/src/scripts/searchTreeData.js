// const fs = require('fs');

// function findMatchingEntries(data, searchCriteria) {
//     const result = {};

//     for (const key in data) {
//         if (data.hasOwnProperty(key)) {
//             const matchingEntries = data[key].filter(entry => entry[3] === searchCriteria);
//             if (matchingEntries.length > 0) {
//                 result[key] = matchingEntries;
//             }
//         }
//     }

//     return result;
// }

// // Read JSON data from file
// const filePath = './smart-contract/src/scripts/storage/chainTreeData.json';

// fs.readFile(filePath, 'utf8', (err, fileData) => {
//     if (err) {
//         console.error('Error reading file:', err);
//         return;
//     }

//     try {
//         const jsonData = JSON.parse(fileData);

//         const searchCriteria = "45";  // Replace with your desired search criteria
//         const result = findMatchingEntries(jsonData, searchCriteria);
//         console.log(result);
//     } catch (parseError) {
//         console.error('Error parsing JSON:', parseError);
//     }
// });
