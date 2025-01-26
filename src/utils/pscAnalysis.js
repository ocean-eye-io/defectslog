// src/utils/pscAnalysis.js

export const CRITICALITY_MAPPING = {
  '10': 'Low - Deficiency Rectified',
  '40': 'Medium - Next Port Informed',
  '18': 'Medium - Rectify Within 3 Months',
  '15': 'Medium - Rectify at Next Port',
  '16': 'Medium - Rectify Within 14 Days',
  '55': 'Medium - Flag State Consulted',
  '70': 'Medium - Recognized Organization Informed',
  '50': 'Medium - Flag State/Consul Informed',
  '17': 'High - Rectify Before Departure',
  '99': 'Medium - Other',
  '26': 'Medium - Security Authority Informed',
  '21': 'High - ISM System Correction Required',
  '45': 'High - Rectify Detainable Deficiency',
  '19': 'High - Safety Management Audit Required',
  '85': 'High - MARPOL Violation Investigation',
  '30': 'Critical - Detention'
};

export const analyzePSCData = (pscData) => {
  return {
    getCommonDeficiencies: () => {
      const deficiencies = {};
      pscData.forEach(record => {
        if (record['Nature of deficiency']) {
          deficiencies[record['Nature of deficiency']] = 
            (deficiencies[record['Nature of deficiency']] || 0) + 1;
        }
      });
      return Object.entries(deficiencies)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    },

    getDeficienciesByCriticality: () => {
      const criticalities = {};
      pscData.forEach(record => {
        const criticality = CRITICALITY_MAPPING[record['Reference Code1']] || 'Unknown';
        criticalities[criticality] = (criticalities[criticality] || 0) + 1;
      });
      return criticalities;
    },

    getDetentionAnalysis: () => {
      return pscData.filter(record => record['Reference Code1'] === '30')
        .map(record => ({
          port: record['Port Name'],
          country: record['Country'],
          date: record['Inspection - From Date'],
          deficiency: record['Nature of deficiency'],
          vesselType: record['Vessel Type']
        }));
    },

    getDeficienciesByPort: () => {
      const portData = {};
      pscData.forEach(record => {
        if (!portData[record['Port Name']]) {
          portData[record['Port Name']] = {
            count: 0,
            country: record['Country'],
            detentions: 0
          };
        }
        portData[record['Port Name']].count++;
        if (record['Reference Code1'] === '30') {
          portData[record['Port Name']].detentions++;
        }
      });
      return portData;
    },

    searchDeficiencies: (searchTerm) => {
      return pscData.filter(record => 
        record['Nature of deficiency']?.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10);
    }
  };
};
