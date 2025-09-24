const fs = require('fs');
const path = require('path');

function run() {
  const today = new Date().toISOString().split('T')[0];
  const logsDir = path.join(__dirname, '..', 'Logs');
  const src = path.join(logsDir, `registrations-${today}.json`);
  
  if (!fs.existsSync(src)) { 
    console.log(`📝 No registrations found for ${today}`);
    return; 
  }
  
  try {
    const csvOut = path.join(logsDir, `registrations-${today}.csv`);
    const rows = JSON.parse(fs.readFileSync(src, 'utf8'));
    
    if (!Array.isArray(rows) || rows.length === 0) { 
      console.log('📝 No valid registration data found');
      return; 
    }
    
    // Get all possible headers from all records
    const allHeaders = new Set();
    rows.forEach(record => {
      if (record && typeof record === 'object') {
        Object.keys(record).forEach(key => allHeaders.add(key));
      }
    });
    
    const headers = Array.from(allHeaders).sort();
    
    // Create CSV content
    const csvLines = [
      headers.join(','), // Header row
      ...rows.map(record => 
        headers.map(header => {
          const value = record[header];
          if (value === null || value === undefined) return '';
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ];
    
    const csvContent = csvLines.join('\n');
    fs.writeFileSync(csvOut, csvContent, 'utf8');
    
    console.log(`✅ Exported ${rows.length} registrations to ${csvOut}`);
    console.log(`📊 Columns: ${headers.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
  }
}

// Allow running directly or as module
if (require.main === module) {
  run();
}

module.exports = { run };
