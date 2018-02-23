const express = require('express');
const axios = require('axios');

const router = express.Router();

function isDataAvailable(patient) {
  return patient.birthDate;
}

function isValidPatientPrefetch(request) {
  const data = request.body;
  if (!(data && data.prefetch && data.prefetch.patient && data.prefetch.patient.resource)) {
    return false;
  }
  return isDataAvailable(data.prefetch.patient.resource);
}

const byCode = (obs, prop) => {
  var ret = {};
  if (!Array.isArray(obs)){
    obs = [obs];
  }
  obs.forEach(function(o){
    if (o.resource.resourceType === "Observation"){
      if (o.resource[prop] && Array.isArray(o.resource[prop].coding)) {
        o.resource[prop].coding.forEach(function (coding){
          ret[coding.code] = ret[coding.code] || [];
          ret[coding.code].push(o.resource);
        });
      }
    }
  });
  return ret;
};

const byCodes = (obs, property) => {
  var bank = byCode(obs, property);
  function byCodes(){
    var ret = [];
    for (var i=0; i<arguments.length;i++){
      var set = bank[arguments[i]];
      if (set) {[].push.apply(ret, set);}
    }
    return ret;
  }

  return byCodes;
};

function shouldTriggerAge(birthDate) {
  function isLeapYear(year) {
    return new Date(year, 1, 29).getMonth() === 1;
  }

  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  birthDate.setFullYear(birthDate.getFullYear() + years);
  if (birthDate > now) {
    years -= 1;
    birthDate.setFullYear(birthDate.getFullYear() - 1);
  }
  const days = (now.getTime() - birthDate.getTime()) / (3600 * 24 * 1000);
  const result = Math.floor(years + (days / (isLeapYear(now.getFullYear()) ? 366 : 365)));
  return result >= 40;
}

function sortObsByTime(obs) {
  const sortedLabs = obs.sort((a, b) => Date.parse(b.effectiveDateTime) - Date.parse(a.effectiveDateTime));
  return sortedLabs;
}

function getFirstValidDataValue(obs, supportedUnitsCriteria) {
  const dataPoints = sortObsByTime(obs);

  for (let i = 0; i < dataPoints.length; i += 1) {
    if ((dataPoints[i].status.toLowerCase() === 'final' || dataPoints[i].status.toLowerCase() === 'amended') &&
      {}.hasOwnProperty.call(dataPoints[i], 'valueQuantity') && dataPoints[i].valueQuantity.value &&
      dataPoints[i].valueQuantity.unit) {
      const dataPointValue = supportedUnitsCriteria(dataPoints[i]);
      if (dataPointValue !== undefined) {
        return dataPointValue;
      }
    }
  }
}

function shouldTriggerCholesterol(obs) {
  const value = getFirstValidDataValue(obs, (dataPoint) => {
    if (dataPoint.valueQuantity.unit === 'mg/dL') {
      return parseFloat(dataPoint.valueQuantity.value);
    } else if (dataPoint.valueQuantity.unit === 'mmol/L') {
      return parseFloat(dataPoint.valueQuantity.value) / 0.026;
    }
    return undefined;
  });
  console.log("VAAAL", value);

  return value >= 50;
}

function retrievePatientResource(fhirServer, patientId, accessToken) {
  const headers = { Accept: 'application/json+fhir' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return axios({
    method: 'get',
    url: `${fhirServer}/Patient/${patientId}`,
    headers,
  }).then((result) => {
    if (result.data && isDataAvailable(result.data)) {
      return result.data;
    }
    throw new Error();
  });
}

function buildCard(message) {
  return {
    cards: [{
      summary: `${message}`,
      source: {
        label: 'ASCVD Risk App service',
      },
      links: [
        {
          label: 'Calculate Risk (ASCVD)',
          type: 'smart',
          url: 'https://engineering.cerner.com/ascvd-risk-calculator/launch.html'
        }
      ],
      indicator: 'warning',
    }],
  };
}

// CDS Service endpoint
router.post('/', (request, response) => {
  console.log("0");
  if (!isValidPatientPrefetch(request)) {
    const { fhirServer, fhirAuthorization } = request.body;
    const patient = request.body.context.patientId;
    let patientPrefetchResults, cholesterolPrefetchResults;
    if (request.body.prefetch) {
      patientPrefetchResults = request.body.prefetch.patient.resource;
      cholesterolPrefetchResults = request.body.prefetch.cholesterol.resource;
    }
    // if (fhirServer && patient) {
    //   let accessToken;
    //   if (fhirAuthorization && fhirAuthorization.access_token) {
    //     accessToken = fhirAuthorization.access_token;
    //   }
    //   retrievePatientResource(fhirServer, patient, accessToken)
    //     .then((result) => {
    //       response.json(buildCard(result));
    //     }).catch(() => {
    //       response.sendStatus(412);
    //     });
    //   return;
    // }
    response.sendStatus(412);
    return;
  }
  let cardMessage = '';
  const name = request.body.prefetch.patient.resource.name[0].given[0];
  const dateObj = new Date((request.body.prefetch.patient.resource.birthDate).replace(/-/g, '/'));
  const getRes = byCodes(request.body.prefetch.cholesterol.resource.entry, 'code');
  const warningFactors = {
    age: shouldTriggerAge(new Date(dateObj.valueOf())),
    cholesterol: shouldTriggerCholesterol(getRes('14647-2', '2093-3')),
    bp: false,
  };
  console.log(warningFactors);

  if (warningFactors.age && warningFactors.cholesterol) {
    console.log("RBUUUGG");
    cardMessage = `${name} is old and has high cholesterol.`;
  } else if (warningFactors.cholesterol) {
    console.log("AAAHH");
    cardMessage = `${name} has high cholesterol`;
  }

  cardMessage = cardMessage + ' Check their cardiac risk.';
  response.json(buildCard(cardMessage));
});

module.exports = router;