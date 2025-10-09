// Enhanced student lookup functions
const { Database } = require('./database');

// Normalize a string for fuzzy matching
function normalizeString(str) {
    if (!str) return '';
    return str.toString()
        .toLowerCase()
        .trim()
        .replace(/[\u0600-\u06FF]/g, c => c) // Keep Arabic characters as is
        .replace(/[^a-z0-9\u0600-\u06FF]/g, '') // Remove special characters except Arabic
        .replace(/\s+/g, '');
}

// Calculate similarity between two strings (0-1)
function calculateSimilarity(str1, str2) {
    const s1 = normalizeString(str1);
    const s2 = normalizeString(str2);
    
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;
    
    let matches = 0;
    const length = Math.min(s1.length, s2.length);
    
    for (let i = 0; i < length; i++) {
        if (s1[i] === s2[i]) matches++;
    }
    
    return matches / Math.max(s1.length, s2.length);
}

// Find student by ID with fuzzy matching
async function findStudentById(studentId, students) {
    if (!studentId) return null;
    
    const normalizedId = normalizeString(studentId);
    
    // Try exact match first
    const exactMatch = students.find(s => normalizeString(s.id) === normalizedId);
    if (exactMatch) return exactMatch;
    
    // Try fuzzy matching if no exact match
    let bestMatch = null;
    let bestScore = 0;
    
    for (const student of students) {
        const score = calculateSimilarity(student.id, studentId);
        if (score > 0.8 && score > bestScore) { // 80% similarity threshold
            bestScore = score;
            bestMatch = student;
        }
    }
    
    return bestMatch;
}

// Find student by name with fuzzy matching
async function findStudentByName(studentName, students) {
    if (!studentName) return null;
    
    const normalizedName = normalizeString(studentName);
    
    // Try exact match first
    const exactMatch = students.find(s => normalizeString(s.name) === normalizedName);
    if (exactMatch) return exactMatch;
    
    // Try fuzzy matching if no exact match
    let bestMatch = null;
    let bestScore = 0;
    
    for (const student of students) {
        const score = calculateSimilarity(student.name, studentName);
        if (score > 0.8 && score > bestScore) { // 80% similarity threshold
            bestScore = score;
            bestMatch = student;
        }
    }
    
    return bestMatch;
}

// Smart student lookup that tries multiple methods
async function smartStudentLookup(searchData) {
    // Get all students from database for local matching
    const allStudents = await Database.getAllStudents();
    
    let student = null;
    
    // Try ID match first
    if (searchData.id) {
        student = await findStudentById(searchData.id, allStudents);
        if (student) return student;
    }
    
    // Try name match if ID fails
    if (searchData.name) {
        student = await findStudentByName(searchData.name, allStudents);
        if (student) return student;
    }
    
    // If no match found and we have both ID and name, create a new student
    if (searchData.id && searchData.name) {
        const newStudent = {
            id: searchData.id,
            name: searchData.name,
            center: searchData.center || 'Unknown Center',
            grade: searchData.grade || 'Unknown Grade',
            subject: searchData.subject || 'Unknown Subject',
            fees: searchData.fees || '0',
            phone: searchData.phone || '',
            parent_phone: searchData.parent_phone || ''
        };
        
        try {
            await Database.createStudent(newStudent);
            return newStudent;
        } catch (error) {
            console.error('Failed to create new student:', error);
            return null;
        }
    }
    
    return null;
}

module.exports = {
    smartStudentLookup,
    findStudentById,
    findStudentByName
};
