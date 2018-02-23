const express = require('express');

const router = express.Router();
const serviceDefinitions = require('./service-definitions');
const ascvdRiskService = require('../services/ascvd-risk-service');

// Discovery Endpoint
router.get('/', (request, response) => {
  const discoveryEndpointServices = {
    services: serviceDefinitions,
  };
  response.json(discoveryEndpointServices);
});

// Routes to patient-greeting CDS Service
router.use('/ascvd-risk-service', ascvdRiskService);
  

module.exports = router;
