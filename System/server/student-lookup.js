const { Database } = require('./database');
const { findBestMatch, findAllMatches } = require('./fuzzy-search');

// Enhanced student lookup with fuzzy matching
async function enhancedStudentLookup(searchData) {
    try {
        let student = null;
        let lookupMethod = 'exact';
        
        // Try exact database lookup first
        if (searchData.id) {
            student = await Database.getStudentById(searchData.id);
            if (student) {
                console.log(`Found exact match for student ID: ${searchData.id}`);
                return { student, lookupMethod };
            }
        }
        
        // Try fuzzy match by ID
        if (searchData.id) {
            student = await findBestMatch(searchData.id, 'id');
            if (student) {
                console.log(`Found fuzzy ID match for: ${searchData.id}`);
                lookupMethod = 'fuzzy_id';
                return { student, lookupMethod };
            }
        }
        
        // Try fuzzy match by name
        if (searchData.name) {
            student = await findBestMatch(searchData.name, 'name');
            if (student) {
                console.log(`Found fuzzy name match for: ${searchData.name}`);
                lookupMethod = 'fuzzy_name';
                return { student, lookupMethod };
            }
        }
        
        // If still no match, get all possible matches
        const allMatches = await findAllMatches(searchData.id || searchData.name);
        if (allMatches.length > 0) {
            console.log(`Found ${allMatches.length} possible matches`);
            lookupMethod = 'multiple_matches';
            return {
                student: allMatches[0].student,  // Return best match
                lookupMethod,
                allMatches
            };
        }
        
        // If no matches found and we have enough info, create a new student
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
                console.log(`Created new student with ID: ${searchData.id}`);
                lookupMethod = 'created_new';
                return { student: newStudent, lookupMethod };
            } catch (error) {
                console.error('Failed to create new student:', error);
            }
        }
        
        return { student: null, lookupMethod: 'not_found' };
    } catch (error) {
        console.error('Enhanced student lookup error:', error);
        return { student: null, lookupMethod: 'error', error: error.message };
    }
}

module.exports = {
    enhancedStudentLookup
};
