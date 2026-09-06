const fs = require('fs');
const pdf = require('pdf-parse');

const dataBuffer = fs.readFileSync('C:\\Users\\alex\\Desktop\\Bulletproof_Automation_QA_Client_Report_n8n_Backup_Manager_2026-05-11.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(err => console.error(err));
