const { Database } = require('./database');

// Normalize text for fuzzy matching
function normalizeText(text) {
    if (!text) return '';
    return text.toString()
        .toLowerCase()
        .trim()
        .replace(/[\u0600-\u06FF]/g, c => c) // Keep Arabic characters
        .replace(/[^\w\u0600-\u06FF]/g, ''); // Remove special chars except Arabic
}

// Calculate similarity between two strings (0-1)
function calculateSimilarity(str1, str2) {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;
    
    let matches = 0;
    const length = Math.min(s1.length, s2.length);
    
    for (let i = 0; i < length; i++) {
        if (s1[i] === s2[i]) matches++;
    }
    
    return matches / Math.max(s1.length, s2.length);
}

// Find best matching student
async function findBestMatch(searchTerm, searchType = 'id') {
    try {
        const students = await Database.getAllStudents();
        let bestMatch = null;
        let bestScore = 0;
        
        for (const student of students) {
            let score;
            
            if (searchType === 'id') {
                score = calculateSimilarity(student.id, searchTerm);
            } else if (searchType === 'name') {
                score = calculateSimilarity(student.name, searchTerm);
            }
            
            // Accept matches above 80% similarity
            if (score > 0.8 && score > bestScore) {
                bestScore = score;
                bestMatch = student;
            }
        }
        
        return bestMatch;
    } catch (error) {
        console.error('Fuzzy search error:', error);
        return null;
    }
}

// Find all possible matches
async function findAllMatches(searchTerm) {
    try {
        const students = await Database.getAllStudents();
        const matches = [];
        
        for (const student of students) {
            const idScore = calculateSimilarity(student.id, searchTerm);
            const nameScore = calculateSimilarity(student.name, searchTerm);
            const bestScore = Math.max(idScore, nameScore);
            
            // Accept matches above 60% similarity
            if (bestScore > 0.6) {
                matches.push({
                    student,
                    score: bestScore,
                    matchType: idScore > nameScore ? 'id' : 'name'
                });
            }
        }
        
        // Sort by score descending
        return matches.sort((a, b) => b.score - a.score);
    } catch (error) {
        console.error('Fuzzy search error:', error);
        return [];
    }
}

module.exports = {
    findBestMatch,
    findAllMatches,
    calculateSimilarity,
    normalizeText
};
