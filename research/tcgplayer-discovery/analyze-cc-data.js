const fs = require('fs');

// Read first few KB of the file to analyze structure
const buffer = fs.readFileSync('/Users/arcadio/dev/pokedao/worker/unified-collector-crypt-dataset.json', {encoding: 'utf8', start: 0, end: 5000});

console.log("First part of file:");
console.log(buffer);

// Try to parse it as JSON array
try {
    // Read smaller sample
    const smallBuffer = fs.readFileSync('/Users/arcadio/dev/pokedao/worker/unified-collector-crypt-dataset.json', {encoding: 'utf8', start: 0, end: 50000});
    
    let data;
    if (smallBuffer.startsWith('[')) {
        // It's an array, let's find the end of first object
        let braceCount = 0;
        let inQuotes = false;
        let firstObjEnd = -1;
        
        for (let i = 1; i < smallBuffer.length; i++) {
            const char = smallBuffer[i];
            
            if (char === '"' && (i === 0 || smallBuffer[i-1] !== '\\')) {
                inQuotes = !inQuotes;
            } else if (!inQuotes) {
                if (char === '{') braceCount++;
                else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        firstObjEnd = i;
                        break;
                    }
                }
            }
        }
        
        if (firstObjEnd > -1) {
            const firstObj = smallBuffer.substring(0, firstObjEnd + 2) + ']';
            data = JSON.parse(firstObj);
            console.log("\n📋 First record structure:");
            console.log(JSON.stringify(data[0], null, 2));
            
            console.log("\n🔑 Properties in first record:");
            Object.keys(data[0]).forEach(key => {
                const value = data[0][key];
                console.log(`  ${key}: ${typeof value} ${Array.isArray(value) ? '(array)' : ''}`);
            });
        }
    }
    
} catch (error) {
    console.error("Error parsing:", error.message);
}
