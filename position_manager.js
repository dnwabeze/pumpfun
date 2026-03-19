const fs = require('fs');
const path = require('path');

const POSITIONS_FILE = path.join(__dirname, 'positions.json');

let positions = {};

function load() {
    if (fs.existsSync(POSITIONS_FILE)) {
        try {
            positions = JSON.parse(fs.readFileSync(POSITIONS_FILE, 'utf8'));
        } catch (e) {
            console.error('Error loading positions:', e.message);
            positions = {};
        }
    } else {
        positions = {};
    }
}

function save() {
    try {
        fs.writeFileSync(POSITIONS_FILE, JSON.stringify(positions, null, 2));
    } catch (e) {
        console.error('Error saving positions:', e.message);
    }
}

function addPosition(mint, data) {
    // data should include: buyMarketCap, developerAddress, timestamp
    positions[mint] = {
        ...data,
        timestamp: Date.now()
    };
    save();
}

function removePosition(mint) {
    if (positions[mint]) {
        delete positions[mint];
        save();
    }
}

function getPosition(mint) {
    return positions[mint];
}

function getAllPositions() {
    return positions;
}

// Initial load
load();

module.exports = {
    addPosition,
    removePosition,
    getPosition,
    getAllPositions
};
