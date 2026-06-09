const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');

// Get all Indian states
router.get('/states', locationController.getStates);

// Get districts by state name
router.get('/districts/:stateName', locationController.getDistrictsByState);

// Get pincodes by state and district
router.get('/pincodes/:stateName/:districtName', locationController.getPincodesByDistrict);

// Get state and district by pincode (auto-fill)
router.get('/lookup/:pincode', locationController.getLocationByPincode);

module.exports = router;
