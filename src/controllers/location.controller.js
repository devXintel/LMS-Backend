const axios = require('axios');

// In-memory cache
const cache = {
    statesData: null, // Will hold the full JSON from GitHub
    pincodes: new Map(), // district -> pincodes array
    lastUpdated: null
};

// URL for comprehensive States & Districts data (maintained by community)
const STATES_DISTRICTS_URL = 'https://raw.githubusercontent.com/sab99r/Indian-States-And-Districts/master/states-and-districts.json';

/**
 * Fetch States and Districts from external GitHub source
 * This ensures we have 100% coverage without hardcoding
 */
const fetchStatesAndDistricts = async () => {
    try {
        if (cache.statesData) return cache.statesData;

        const response = await axios.get(STATES_DISTRICTS_URL);

        if (response.data && response.data.states) {
            cache.statesData = response.data.states;
            return cache.statesData;
        }
    } catch (error) {
        console.error('Error fetching states data:', error.message);
        // Retry logic could be added here, or we let the next request try again
        return null;
    }
};

// Initialize data on startup
fetchStatesAndDistricts().catch(console.error);

/* GET ALL STATES */
exports.getStates = async (req, res) => {
    try {
        const data = await fetchStatesAndDistricts();
        if (!data) {
            return res.status(503).json({ message: 'Location data unavailable' });
        }

        const states = data.map(s => s.state).sort();

        res.json({
            message: 'States fetched successfully',
            states
        });
    } catch (error) {
        console.error('Get states error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* GET DISTRICTS BY STATE */
exports.getDistrictsByState = async (req, res) => {
    const { stateName } = req.params;

    try {
        if (!stateName) {
            return res.status(400).json({ message: 'State name is required' });
        }

        const data = await fetchStatesAndDistricts();
        if (!data) {
            return res.status(503).json({ message: 'Location data unavailable' });
        }

        const stateData = data.find(s => s.state.toLowerCase() === stateName.toLowerCase());

        if (!stateData) {
            return res.json({
                message: 'State not found',
                districts: []
            });
        }

        res.json({
            message: 'Districts fetched successfully',
            districts: stateData.districts.sort()
        });
    } catch (error) {
        console.error('Get districts by state error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* GET PINCODES BY STATE AND DISTRICT */
exports.getPincodesByDistrict = async (req, res) => {
    const { stateName, districtName } = req.params;

    try {
        if (!stateName || !districtName) {
            return res.status(400).json({ message: 'State and district names are required' });
        }

        // Check cache first
        const cacheKey = `${stateName}|${districtName}`.toLowerCase();
        if (cache.pincodes.has(cacheKey)) {
            return res.json({
                message: 'Pincodes fetched successfully (from cache)',
                pincodes: cache.pincodes.get(cacheKey)
            });
        }

        // Fetch from India Post API
        // We search by District Name to get post offices in that district
        const response = await axios.get(`https://api.postalpincode.in/postoffice/${encodeURIComponent(districtName)}`);

        if (response.data && response.data[0] && response.data[0].Status === 'Success') {
            const postOffices = response.data[0].PostOffice || [];

            // Extract unique pincodes
            // Filter by State strictly to avoid cross-state district name collisions
            // (e.g. "Aurangabad" exists in Bihar and Maharashtra)
            const pincodesSet = new Set();

            postOffices.forEach(office => {
                if (office.Pincode &&
                    office.State.toLowerCase().includes(stateName.toLowerCase())) {
                    pincodesSet.add(office.Pincode);
                }
            });

            const pincodes = Array.from(pincodesSet).sort();

            // Cache the result
            cache.pincodes.set(cacheKey, pincodes);

            res.json({
                message: 'Pincodes fetched successfully',
                pincodes
            });
        } else {
            res.json({
                message: 'No pincodes found for this district',
                pincodes: []
            });
        }
    } catch (error) {
        console.error('Get pincodes by district error:', error.message);
        // Fallback: If API fails, return empty array rather than 500
        res.json({
            message: 'Could not fetch pincodes at this time',
            pincodes: []
        });
    }
};

/* GET STATE & DISTRICT BY PINCODE */
exports.getLocationByPincode = async (req, res) => {
    const { pincode } = req.params;

    try {
        if (!pincode || !/^\d{6}$/.test(pincode)) {
            return res.status(400).json({ message: 'A valid 6-digit pincode is required' });
        }

        const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);

        if (
            response.data &&
            response.data[0] &&
            response.data[0].Status === 'Success' &&
            response.data[0].PostOffice &&
            response.data[0].PostOffice.length > 0
        ) {
            const postOffice = response.data[0].PostOffice[0];
            return res.json({
                message: 'Location found',
                state: postOffice.State,
                district: postOffice.District
            });
        } else {
            return res.status(404).json({ message: 'No location found for this pincode' });
        }
    } catch (error) {
        console.error('Get location by pincode error:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
