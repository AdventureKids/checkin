import React, { useState, useEffect } from 'react';

// Use relative URL in production (same origin), localhost in development
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

// ============================================
// AVATAR SYSTEM - Single explorer character
// ============================================
const AVATAR_STATIC = '/avatars/boy-ranger/boy-test-000.png';
const DEFAULT_AVATAR = 'explorer';

// Get avatar URL - returns the static PNG for all avatars
const getAvatarUrl = () => AVATAR_STATIC;

// Calculate age from birthday
const calculateAge = (birthday) => {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// ============================================
// CSV IMPORT MODAL COMPONENT
// ============================================

function CSVImportModal({ isOpen, onClose, importType, token, onSuccess }) {
  const [step, setStep] = useState(1); // 1: upload, 2: map columns, 2.5: value mapping, 3: importing, 4: done
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [customFields, setCustomFields] = useState([]);
  const [valueMappings, setValueMappings] = useState({}); // For compliance fields: which values mean "complete"
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');

  // Fields that need value mapping (boolean/completion status)
  const complianceFields = ['livescan_date', 'mandatory_reporter_date'];

  // Define required/optional fields based on import type
  const fieldDefinitions = importType === 'volunteers' ? {
    required: [
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'phone', label: 'Phone Number' },
    ],
    optional: [
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Street Address' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'zip', label: 'Zip Code' },
      { key: 'dob', label: 'Date of Birth' },
      { key: 'service_area', label: 'Service Area / Ministry' },
      { key: 'livescan_date', label: 'LiveScan Completed', isCompliance: true },
      { key: 'mandatory_reporter_date', label: 'Mandatory Reporter Completed', isCompliance: true },
      { key: 'serving_frequency', label: 'Serving Frequency' },
      { key: 'start_date', label: 'Start Date' },
    ]
  } : {
    required: [
      { key: 'parent_name', label: 'Parent/Guardian Name' },
      { key: 'phone', label: 'Phone Number' },
    ],
    optional: [
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Address' },
      { key: 'child_first_name', label: 'Child First Name' },
      { key: 'child_last_name', label: 'Child Last Name' },
      { key: 'child_birthday', label: 'Child Birthday' },
      { key: 'child_gender', label: 'Child Gender' },
      { key: 'child_allergies', label: 'Child Allergies' },
      { key: 'child_notes', label: 'Child Notes' },
    ]
  };

  const allFields = [...fieldDefinitions.required, ...fieldDefinitions.optional];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setError('CSV file must have at least a header row and one data row');
          return;
        }

        // Parse CSV (handle quoted values)
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseCSVLine(lines[0]);
        const data = lines.slice(1).map(line => {
          const values = parseCSVLine(line);
          const row = {};
          headers.forEach((header, i) => {
            row[header] = values[i] || '';
          });
          return row;
        }).filter(row => Object.values(row).some(v => v)); // Filter empty rows

        setCsvHeaders(headers);
        setCsvData(data);

        // Auto-map columns based on header names
        const autoMapping = {};
        const usedHeaders = new Set();
        
        allFields.forEach(field => {
          // Try to find a matching header for this field
          const matchingHeader = headers.find(h => {
            if (usedHeaders.has(h)) return false;
            const headerNorm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            const keyNorm = field.key.replace(/_/g, '');
            const labelNorm = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
            return headerNorm.includes(keyNorm) || headerNorm.includes(labelNorm) ||
                   keyNorm.includes(headerNorm) || labelNorm.includes(headerNorm);
          });
          if (matchingHeader) {
            autoMapping[field.key] = matchingHeader;
            usedHeaders.add(matchingHeader);
          }
        });
        setColumnMapping(autoMapping);

        // Initialize ALL columns as potential custom fields (users can toggle any to custom)
        setCustomFields(headers.map(h => ({
          csv_column: h,
          field_name: h.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          field_label: h,
          include: false // Start with all as not-included, user can mark as custom
        })));

        setStep(2);
      } catch (err) {
        setError('Failed to parse CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    // Validate required fields are mapped
    const missingRequired = fieldDefinitions.required.filter(f => !columnMapping[f.key]);
    if (missingRequired.length > 0) {
      setError(`Please map required fields: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }

    setImporting(true);
    setError('');
    setStep(3);

    try {
      const includedCustomFields = customFields.filter(cf => cf.include);
      
      const url = `${API_BASE}/api/import/${importType}`;
      console.log('Import URL:', url);
      console.log('API_BASE:', API_BASE);
      console.log('importType:', importType);
      console.log('Data rows:', csvData.length);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          data: csvData,
          columnMapping,
          customFields: includedCustomFields,
          valueMappings // Include which values mean "completed" for compliance fields
        })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Response text (first 500 chars):', responseText.substring(0, 500));
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(`Server returned invalid JSON. Status: ${response.status}. Response: ${responseText.substring(0, 200)}`);
      }
      
      if (response.ok) {
        setImportResult(result);
        setStep(4);
        if (onSuccess) onSuccess();
      } else {
        setError(result.error || 'Import failed');
        setStep(2);
      }
    } catch (err) {
      setError('Failed to import: ' + err.message);
      setStep(2);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setCustomFields([]);
    setValueMappings({});
    setImportResult(null);
    setError('');
    onClose();
  };

  const toggleCustomField = (index) => {
    setCustomFields(prev => prev.map((cf, i) => 
      i === index ? { ...cf, include: !cf.include } : cf
    ));
  };

  // Get unique values for a mapped column (for compliance field value mapping)
  const getUniqueValues = (fieldKey) => {
    const csvColumn = columnMapping[fieldKey];
    if (!csvColumn) return [];
    const values = csvData.map(row => row[csvColumn]).filter(v => v !== undefined && v !== null);
    const unique = [...new Set(values)].slice(0, 20); // Limit to 20 unique values
    return unique;
  };

  // Check if any compliance fields are mapped (need value mapping step)
  const hasMappedComplianceFields = () => {
    return complianceFields.some(field => columnMapping[field]);
  };

  // Auto-detect if a value looks like "complete" or a date
  const detectCompletionValue = (value) => {
    if (!value) return false;
    const v = String(value).toLowerCase().trim();
    // Common "complete" patterns
    if (['o', 'yes', 'y', 'true', '1', '✓', '✔', 'complete', 'completed', 'done', 'x'].includes(v)) return true;
    // Check if it looks like a date (has numbers and possibly slashes, dashes, or is a date string)
    if (/\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}/.test(v)) return true;
    if (/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(v)) return true;
    // Check for month names
    if (/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(v)) return true;
    return false;
  };

  // Initialize value mappings for compliance fields
  const initializeValueMappings = () => {
    const mappings = {};
    complianceFields.forEach(field => {
      const csvColumn = columnMapping[field];
      if (csvColumn) {
        const uniqueValues = getUniqueValues(field);
        // Auto-detect which values mean "complete"
        const completedValues = uniqueValues.filter(v => detectCompletionValue(v));
        mappings[field] = {
          csvColumn,
          uniqueValues,
          completedValues: completedValues.length > 0 ? completedValues : [],
          treatAsDate: uniqueValues.some(v => /\d{1,4}[-\/]\d{1,2}/.test(String(v)))
        };
      }
    });
    setValueMappings(mappings);
  };

  // Proceed to value mapping step or directly to import
  const handleProceedFromMapping = () => {
    // Validate required fields
    const missingRequired = fieldDefinitions.required.filter(f => !columnMapping[f.key]);
    if (missingRequired.length > 0) {
      setError(`Please map required fields: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }
    
    if (hasMappedComplianceFields()) {
      initializeValueMappings();
      setStep(2.5);
    } else {
      handleImport();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">
              Import {importType === 'volunteers' ? 'Volunteers' : 'Families'}
            </h3>
            <p className="text-slate-400 text-sm">
              {step === 1 && 'Upload a CSV file to get started'}
              {step === 2 && 'Map your columns to our fields'}
              {step === 2.5 && 'Configure compliance field values'}
              {step === 3 && 'Importing your data...'}
              {step === 4 && 'Import complete!'}
            </p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-white text-2xl">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 mb-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">📄</span>
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Upload CSV File</h4>
              <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
                Export your data from your current system as a CSV file, then upload it here. 
                We'll help you map the columns to our system.
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 cursor-pointer transition-colors"
              >
                Choose CSV File
              </label>
              <p className="text-slate-500 text-xs mt-4">
                Supported: .csv files with headers in the first row
              </p>
            </div>
          )}

          {/* Step 2: Map Columns */}
          {step === 2 && (
            <div>
              <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
                <p className="text-white font-medium mb-1">📊 Preview: {csvData.length} rows found, {csvHeaders.length} columns</p>
                <p className="text-slate-400 text-sm">For each column in your CSV, choose what it maps to in our system.</p>
              </div>

              {/* Column Mapping - CSV Column Centric */}
              <div className="mb-6">
                <h4 className="text-white font-medium mb-3">Map Your Columns</h4>
                <p className="text-slate-400 text-sm mb-4">
                  Required fields: {fieldDefinitions.required.map(f => f.label).join(', ')}
                </p>
                
                <div className="space-y-2">
                  {csvHeaders.map((header, index) => {
                    // Check if this header is mapped to a standard field
                    const mappedToField = Object.entries(columnMapping).find(([key, val]) => val === header)?.[0];
                    const fieldInfo = allFields.find(f => f.key === mappedToField);
                    const isRequired = fieldDefinitions.required.some(f => f.key === mappedToField);
                    
                    // Check if marked as custom field
                    const customFieldEntry = customFields.find(cf => cf.csv_column === header);
                    const isCustomField = customFieldEntry?.include;
                    
                    // Sample value from first row
                    const sampleValue = csvData[0]?.[header] || '';
                    
                    return (
                      <div key={header} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                        {/* CSV Column Name */}
                        <div className="w-48 flex-shrink-0">
                          <p className="text-white font-medium text-sm truncate" title={header}>{header}</p>
                          <p className="text-slate-500 text-xs truncate" title={sampleValue}>
                            e.g. "{sampleValue.substring(0, 30)}{sampleValue.length > 30 ? '...' : ''}"
                          </p>
                        </div>
                        
                        {/* Arrow */}
                        <span className="text-slate-500">→</span>
                        
                        {/* Mapping Dropdown */}
                        <select
                          value={isCustomField ? '__custom__' : (mappedToField || '')}
                          onChange={(e) => {
                            const value = e.target.value;
                            
                            if (value === '__custom__') {
                              // Mark as custom field
                              setCustomFields(prev => prev.map(cf => 
                                cf.csv_column === header ? { ...cf, include: true } : cf
                              ));
                              // Remove from standard mapping if it was mapped
                              if (mappedToField) {
                                setColumnMapping(prev => {
                                  const newMapping = { ...prev };
                                  delete newMapping[mappedToField];
                                  return newMapping;
                                });
                              }
                            } else if (value === '') {
                              // Skip this column
                              setCustomFields(prev => prev.map(cf => 
                                cf.csv_column === header ? { ...cf, include: false } : cf
                              ));
                              if (mappedToField) {
                                setColumnMapping(prev => {
                                  const newMapping = { ...prev };
                                  delete newMapping[mappedToField];
                                  return newMapping;
                                });
                              }
                            } else {
                              // Map to standard field
                              setCustomFields(prev => prev.map(cf => 
                                cf.csv_column === header ? { ...cf, include: false } : cf
                              ));
                              // Remove old mapping for this header
                              const newMapping = { ...columnMapping };
                              Object.keys(newMapping).forEach(key => {
                                if (newMapping[key] === header) delete newMapping[key];
                              });
                              // Add new mapping
                              newMapping[value] = header;
                              setColumnMapping(newMapping);
                            }
                          }}
                          className={`flex-1 bg-slate-600 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none ${
                            isRequired ? 'border-emerald-500' : 
                            mappedToField || isCustomField ? 'border-blue-500' : 'border-slate-500'
                          }`}
                        >
                          <option value="">-- Skip this column --</option>
                          <optgroup label="Standard Fields">
                            {allFields.map(field => {
                              const isAlreadyMapped = columnMapping[field.key] && columnMapping[field.key] !== header;
                              return (
                                <option 
                                  key={field.key} 
                                  value={field.key}
                                  disabled={isAlreadyMapped}
                                >
                                  {field.label} {fieldDefinitions.required.some(f => f.key === field.key) ? '*' : ''}
                                  {isAlreadyMapped ? ` (mapped to "${columnMapping[field.key]}")` : ''}
                                </option>
                              );
                            })}
                          </optgroup>
                          <optgroup label="Custom">
                            <option value="__custom__">💾 Save as Custom Field</option>
                          </optgroup>
                        </select>
                        
                        {/* Status indicator */}
                        <div className="w-24 text-right">
                          {isRequired && <span className="text-emerald-400 text-xs font-medium">✓ Required</span>}
                          {mappedToField && !isRequired && <span className="text-blue-400 text-xs">Mapped</span>}
                          {isCustomField && <span className="text-amber-400 text-xs">Custom</span>}
                          {!mappedToField && !isCustomField && <span className="text-slate-500 text-xs">Skipped</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Required Fields Check */}
              {fieldDefinitions.required.some(f => !columnMapping[f.key]) && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                  <p className="text-red-400 font-medium text-sm mb-1">⚠️ Missing Required Fields</p>
                  <p className="text-red-300 text-sm">
                    Please map: {fieldDefinitions.required.filter(f => !columnMapping[f.key]).map(f => f.label).join(', ')}
                  </p>
                </div>
              )}

              {/* Preview */}
              <div className="mb-6">
                <h4 className="text-white font-medium mb-3">Data Preview (first 3 rows)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-700">
                        {csvHeaders.slice(0, 6).map(header => (
                          <th key={header} className="text-left text-slate-300 px-3 py-2 font-medium">{header}</th>
                        ))}
                        {csvHeaders.length > 6 && <th className="text-slate-400 px-3 py-2">...</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-slate-600">
                          {csvHeaders.slice(0, 6).map(header => (
                            <td key={header} className="text-slate-300 px-3 py-2 truncate max-w-[150px]">{row[header]}</td>
                          ))}
                          {csvHeaders.length > 6 && <td className="text-slate-400 px-3 py-2">...</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 2.5: Value Mapping for Compliance Fields */}
          {step === 2.5 && (
            <div>
              <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
                <p className="text-white font-medium mb-1">🔍 Configure Compliance Values</p>
                <p className="text-slate-400 text-sm">
                  We detected compliance fields in your import. Help us understand which values mean "completed".
                </p>
              </div>

              {Object.entries(valueMappings).map(([fieldKey, mapping]) => {
                const fieldDef = allFields.find(f => f.key === fieldKey);
                return (
                  <div key={fieldKey} className="mb-6 bg-slate-700/30 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">
                      {fieldDef?.label || fieldKey}
                      <span className="text-slate-400 text-sm font-normal ml-2">
                        (from column: "{mapping.csvColumn}")
                      </span>
                    </h4>
                    
                    {/* Show unique values found */}
                    <p className="text-slate-400 text-sm mb-3">
                      We found {mapping.uniqueValues.length} unique value(s) in this column. 
                      Select which values indicate completion:
                    </p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                      {mapping.uniqueValues.map((value, idx) => {
                        const isSelected = mapping.completedValues.includes(value);
                        const displayValue = value === '' ? '(empty)' : String(value);
                        return (
                          <label 
                            key={idx}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                              isSelected ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-slate-600/50 hover:bg-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setValueMappings(prev => ({
                                  ...prev,
                                  [fieldKey]: {
                                    ...prev[fieldKey],
                                    completedValues: isSelected
                                      ? prev[fieldKey].completedValues.filter(v => v !== value)
                                      : [...prev[fieldKey].completedValues, value]
                                  }
                                }));
                              }}
                              className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-emerald-500"
                            />
                            <span className={`text-sm truncate ${isSelected ? 'text-emerald-300' : 'text-slate-300'}`}>
                              {displayValue.length > 20 ? displayValue.substring(0, 20) + '...' : displayValue}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Date detection hint */}
                    {mapping.treatAsDate && (
                      <p className="text-blue-400 text-xs">
                        💡 This looks like a date field. Any non-empty date value will be saved, and the volunteer will be marked as completed.
                      </p>
                    )}
                    
                    {/* Summary */}
                    <p className="text-slate-500 text-xs mt-2">
                      {mapping.completedValues.length > 0 
                        ? `✓ Values that mean "completed": ${mapping.completedValues.map(v => v === '' ? '(empty)' : `"${v}"`).join(', ')}`
                        : '⚠️ No values selected - this field will be skipped'
                      }
                    </p>
                  </div>
                );
              })}

              {Object.keys(valueMappings).length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  No compliance fields to configure.
                </div>
              )}
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 3 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <span className="text-4xl">⏳</span>
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Importing Data...</h4>
              <p className="text-slate-400 text-sm">
                Processing {csvData.length} records. This may take a moment.
              </p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && importResult && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">✅</span>
              </div>
              <h4 className="text-lg font-semibold text-white mb-4">Import Complete!</h4>
              
              <div className={`grid gap-4 max-w-lg mx-auto mb-6 ${importType === 'volunteers' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-3xl font-bold text-emerald-400">{importResult.imported}</p>
                  <p className="text-slate-400 text-sm">New Records</p>
                </div>
                {importType === 'volunteers' && importResult.updated !== undefined && (
                  <div className="bg-slate-700 rounded-lg p-4">
                    <p className="text-3xl font-bold text-blue-400">{importResult.updated}</p>
                    <p className="text-slate-400 text-sm">Parents Merged</p>
                  </div>
                )}
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-3xl font-bold text-amber-400">{importResult.skipped}</p>
                  <p className="text-slate-400 text-sm">Skipped</p>
                </div>
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-3xl font-bold text-slate-300">{importResult.total}</p>
                  <p className="text-slate-400 text-sm">Total Rows</p>
                </div>
              </div>

              {importType === 'volunteers' && importResult.updated > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4 text-left max-w-md mx-auto mb-4">
                  <p className="text-blue-400 font-medium mb-1">👥 Parents Merged as Volunteers</p>
                  <p className="text-blue-300 text-sm">
                    {importResult.updated} existing parent(s) were found by phone number and marked as volunteers. 
                    No duplicate profiles were created!
                  </p>
                </div>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-left max-w-md mx-auto mb-6">
                  <p className="text-red-400 font-medium mb-2">Some rows had errors:</p>
                  <ul className="text-red-300 text-sm space-y-1">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-slate-400 text-sm mb-6">
                {importResult.skipped > 0 && 'Skipped rows may have duplicate phone numbers or missing required data.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-between">
          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleProceedFromMapping}
                disabled={importing}
                className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {hasMappedComplianceFields() ? 'Next: Configure Values →' : `Import ${csvData.length} Records`}
              </button>
            </>
          )}
          {step === 2.5 && (
            <>
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                ← Back to Mapping
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                Import {csvData.length} Records
              </button>
            </>
          )}
          {(step === 1 || step === 4) && (
            <button
              onClick={handleClose}
              className="ml-auto px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              {step === 4 ? 'Done' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// LOGIN SCREEN
// ============================================

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('adminToken', data.token);
        onLogin(data.token);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Adventure Kids</h1>
          <p className="text-slate-400">Admin Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 mb-6 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-slate-300 mb-2 text-sm">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="admin"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-slate-300 mb-2 text-sm">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <a href="/" className="block text-center mt-6 text-slate-400 hover:text-white transition-colors text-sm">
            ← Back to Kiosk
          </a>
        </form>
      </div>
    </div>
  );
}

// ============================================
// SIDEBAR
// ============================================

function Sidebar({ activeTab, setActiveTab, logo, onLogout }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'families', label: 'Families', icon: '👨‍👩‍👧‍👦' },
    { id: 'volunteers', label: 'Volunteers', icon: '🙋' },
    { id: 'rewards', label: 'Rewards', icon: '🎁' },
    { id: 'reports', label: 'Reports', icon: '📋' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="w-64 bg-slate-900 min-h-screen p-6 flex flex-col">
      <div className="mb-8">
        {logo ? (
          <img src={logo} alt="Logo" className="h-16 mx-auto" />
        ) : (
          <h1 className="text-xl font-bold text-white text-center">Adventure Kids</h1>
        )}
        <p className="text-slate-400 text-sm text-center mt-2">Admin Dashboard</p>
      </div>
      
      <nav className="flex-1">
        {tabs.map((tab) => (
            <button
              key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-500 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
        ))}
      </nav>
      
      <div className="space-y-2">
      <a
        href="/"
        className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white transition-colors"
      >
        <span>🖥️</span>
        <span>Back to Kiosk</span>
      </a>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 transition-colors"
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

// ============================================
// DASHBOARD TAB
// ============================================

function DashboardTab({ token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
    const [roomFilter, setRoomFilter] = useState('all');
    
    const rooms = [
      { id: 'all', name: 'All Rooms' },
      { id: 'room100', name: 'Room 100' },
      { id: 'room101', name: 'Room 101' },
      { id: 'room102', name: 'Room 102' },
      { id: 'room103', name: 'Room 103' },
    ];
  
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Failed to load dashboard data</div>
      </div>
    );
  }

  // Filter attendance by room (simplified - would need backend support for real filtering)
  const getFilteredAttendance = () => {
    if (!stats.attendance) return [];
    if (roomFilter === 'all') return stats.attendance;
    
      const roomMultipliers = {
        'room100': 0.15,
        'room101': 0.25,
        'room102': 0.30,
        'room103': 0.30
      };
    return stats.attendance.map(a => ({
      ...a,
      count: Math.round(a.count * (roomMultipliers[roomFilter] || 0.25))
    }));
    };
    
    const filteredAttendance = getFilteredAttendance();
  
    return (
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>
        
      {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">Total Families</p>
          <p className="text-3xl font-bold text-white">{stats.totalFamilies}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">Total Kids</p>
          <p className="text-3xl font-bold text-white">{stats.totalKids}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p className="text-slate-400 text-sm mb-2">Total Check-ins</p>
          <p className="text-3xl font-bold text-emerald-400">{stats.totalCheckins}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p className="text-slate-400 text-sm mb-2">Avg per Sunday</p>
          <p className="text-3xl font-bold text-white">
            {stats.attendance?.length > 0 
              ? Math.round(stats.attendance.reduce((s, a) => s + a.count, 0) / stats.attendance.length)
              : 0}
          </p>
          </div>
        </div>
  
      {/* Attendance Chart */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Attendance</h3>
            <div className="flex gap-2">
            {rooms.map((room) => (
                  <button
                    key={room.id}
                onClick={() => setRoomFilter(room.id)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  roomFilter === room.id
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                  >
                    {room.name}
                  </button>
            ))}
            </div>
          </div>
          <div className="flex items-end gap-4" style={{ height: '200px' }}>
          {filteredAttendance.length > 0 ? (
            filteredAttendance.slice(0, 8).map((week, i) => {
              const maxCount = roomFilter === 'all' ? 60 : 20;
              const heightPx = Math.round((week.count / maxCount) * 150);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div 
                    className="w-full bg-emerald-500 rounded-t-lg transition-all hover:bg-emerald-400"
                    style={{ height: `${Math.max(heightPx, 4)}px` }}
                  />
                  <p className="text-slate-400 text-xs mt-2">{week.date?.slice(5) || '-'}</p>
                  <p className="text-white text-sm font-semibold">{week.count}</p>
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              No attendance data yet
            </div>
          )}
          </div>
        </div>
  
      {/* Top Streaks */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">🔥 Top Streaks</h3>
          <div className="space-y-3">
          {stats.topStreaks?.length > 0 ? (
            stats.topStreaks.map((kid, i) => (
                <div key={kid.id} className="flex items-center gap-4 bg-slate-700/50 rounded-lg p-3">
                  <span className="text-2xl font-bold text-slate-500 w-8">#{i + 1}</span>
                <img 
                  src={getAvatarUrl()} 
                  alt={kid.name}
                  className="w-10 h-10 rounded-full bg-slate-600"
                />
                  <div className="flex-1">
                    <p className="text-white font-semibold">{kid.name}</p>
                    <p className="text-slate-400 text-sm">{kid.familyName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-orange-400 font-bold">{kid.streak} weeks</p>
                    <p className="text-slate-400 text-sm">{kid.badges} badges</p>
                  </div>
                </div>
            ))
          ) : (
            <div className="text-slate-400 text-center py-4">No streaks yet - check in some kids!</div>
          )}
          </div>
        </div>
      </div>
    );
  }

// ============================================
// FAMILIES TAB
// ============================================

function FamiliesTab({ token }) {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit modes
  const [editingFamily, setEditingFamily] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [addingChild, setAddingChild] = useState(false);
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Form states
  const [familyForm, setFamilyForm] = useState({ name: '', phone: '', email: '', parentName: '' });
  const [childForm, setChildForm] = useState({
    first_name: '', last_name: '', birthday: '', gender: '', pin: '', avatar: 'felix', allergies: '', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Pending rewards state (admin-assigned rewards for next check-in)
  const [pendingRewards, setPendingRewards] = useState([]);
  const [showAddRewardModal, setShowAddRewardModal] = useState(false);
  const [newReward, setNewReward] = useState({
    reward_type: 'custom',
    custom_name: '',
    custom_description: '',
    custom_icon: '🎁'
  });

  // Generate PIN from birthday (MMDDYY format)
  const generatePinFromBirthday = (birthday) => {
    if (!birthday) return '';
    // Parse the date string directly to avoid timezone issues
    // birthday format is YYYY-MM-DD from the date input
    const parts = birthday.split('-');
    if (parts.length !== 3) return '';
    const year = parts[0].slice(-2); // Last 2 digits of year
    const month = parts[1];
    const day = parts[2];
    return `${month}${day}${year}`;
  };

  useEffect(() => {
    fetchFamilies();
  }, []);

  // Fetch pending rewards when editing a child
  const fetchPendingRewards = async (childId) => {
    try {
      const response = await fetch(`${API_BASE}/api/child/${childId}/pending-rewards`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPendingRewards(data);
      }
    } catch (err) {
      console.error('Error fetching pending rewards:', err);
    }
  };

  const handleAddPendingReward = async (childId) => {
    if (!childId) {
      console.error('No childId provided to handleAddPendingReward');
      return;
    }
    
    if (!newReward.custom_name) {
      alert('Please enter a reward name');
      return;
    }
    
    try {
      const rewardData = {
        reward_type: 'custom',
        custom_name: newReward.custom_name,
        custom_description: newReward.custom_description,
        custom_icon: newReward.custom_icon,
        assigned_by: 'Admin'
      };
      
      console.log('Adding pending reward:', { childId, rewardData });
      
      const response = await fetch(`${API_BASE}/api/child/${childId}/pending-rewards`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(rewardData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('Reward added successfully:', data);
        await fetchPendingRewards(childId);
        setShowAddRewardModal(false);
        setNewReward({
          reward_type: 'custom',
          custom_name: '',
          custom_description: '',
          custom_icon: '🎁'
        });
      } else {
        console.error('Failed to add reward:', data);
        alert(`Failed to add reward: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error adding pending reward:', err);
      alert(`Error adding reward: ${err.message}`);
    }
  };

  const handleRemovePendingReward = async (childId, rewardId) => {
    try {
      await fetch(`${API_BASE}/api/child/${childId}/pending-rewards/${rewardId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchPendingRewards(childId);
    } catch (err) {
      console.error('Error removing pending reward:', err);
    }
  };

  const fetchFamilies = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/families`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setFamilies(data);
    } catch (err) {
      console.error('Error fetching families:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFamily = async (familyId) => {
    if (!confirm('Are you sure you want to delete this family? This cannot be undone.')) {
      return;
    }

    try {
      await fetch(`${API_BASE}/api/family/${familyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setFamilies(families.filter(f => f.id !== familyId));
      setSelectedFamily(null);
    } catch (err) {
      console.error('Error deleting family:', err);
      alert('Failed to delete family');
    }
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 10) {
      return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    return phone;
  };

  // Family editing
  const handleEditFamily = () => {
    setFamilyForm({
      name: selectedFamily.name || '',
      phone: selectedFamily.phone || '',
      email: selectedFamily.email || '',
      parentName: selectedFamily.parent_name || ''
    });
    setEditingFamily(true);
    setError('');
  };

  const handleSaveFamily = async () => {
    if (!familyForm.name.trim() || !familyForm.phone.trim()) {
      setError('Family name and phone are required');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/family/${selectedFamily.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(familyForm)
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update family');
      }
      
      await fetchFamilies();
      const updatedFamily = families.find(f => f.id === selectedFamily.id);
      setSelectedFamily({ ...selectedFamily, ...familyForm });
      setEditingFamily(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNewFamily = async () => {
    if (!familyForm.name.trim() || !familyForm.phone.trim()) {
      setError('Family name and phone are required');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/family`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: familyForm.name,
          phone: familyForm.phone,
          email: familyForm.email,
          parentName: familyForm.parentName,
          children: []
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create family');
      }
      
      await fetchFamilies();
      setShowAddFamilyModal(false);
      setFamilyForm({ name: '', phone: '', email: '', parentName: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Child editing
  const handleEditChild = (child) => {
    setChildForm({
      first_name: child.first_name || child.name?.split(' ')[0] || '',
      last_name: child.last_name || child.name?.split(' ').slice(1).join(' ') || '',
      birthday: child.birthday || '',
      gender: child.gender || '',
      pin: child.pin || '',
      avatar: child.avatar || 'felix',
      allergies: child.allergies || '',
      notes: child.notes || ''
    });
    setEditingChild(child.id);
    setEditingChildAvatar(null);
    setError('');
    fetchPendingRewards(child.id);
  };

  const handleSaveChild = async () => {
    if (!childForm.first_name.trim()) {
      setError('First name is required');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/child/${editingChild}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(childForm)
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update child');
      }
      
      await fetchFamilies();
      // Update selected family with new data
      const updatedFamilies = await fetch(`${API_BASE}/api/families`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());
      const updatedFamily = updatedFamilies.find(f => f.id === selectedFamily.id);
      if (updatedFamily) setSelectedFamily(updatedFamily);
      
      setEditingChild(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddChild = () => {
    setChildForm({
      first_name: '', last_name: '', birthday: '', gender: '', pin: '', avatar: 'felix', allergies: '', notes: ''
    });
    setAddingChild(true);
    setError('');
  };

  const handleSaveNewChild = async () => {
    if (!childForm.first_name.trim()) {
      setError('First name is required');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/family/${selectedFamily.id}/child`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(childForm)
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add child');
      }
      
      await fetchFamilies();
      // Update selected family with new data
      const updatedFamilies = await fetch(`${API_BASE}/api/families`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());
      const updatedFamily = updatedFamilies.find(f => f.id === selectedFamily.id);
      if (updatedFamily) setSelectedFamily(updatedFamily);
      
      setAddingChild(false);
      setChildForm({ first_name: '', last_name: '', birthday: '', gender: '', pin: '', avatar: 'felix', allergies: '', notes: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChild = async (childId, childName) => {
    if (!confirm(`Are you sure you want to delete ${childName}? This will also delete their check-in history.`)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/child/${childId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete child');
      }
      
      await fetchFamilies();
      // Update selected family
      const updatedFamilies = await fetch(`${API_BASE}/api/families`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());
      const updatedFamily = updatedFamilies.find(f => f.id === selectedFamily.id);
      if (updatedFamily) {
        setSelectedFamily(updatedFamily);
      } else {
        // Family was deleted (no more children)
        setSelectedFamily(null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading families...</div>
      </div>
    );
  }

  // Filter families based on search term
  const filteredFamilies = families.filter(family => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const childNames = family.children?.map(c => c.name?.toLowerCase() || '').join(' ') || '';
    return (
      family.name?.toLowerCase().includes(search) ||
      family.phone?.includes(search) ||
      family.email?.toLowerCase().includes(search) ||
      family.parent_name?.toLowerCase().includes(search) ||
      childNames.includes(search)
    );
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
        <h2 className="text-2xl font-bold text-white">Families</h2>
          <p className="text-slate-400 text-sm">{families.length} families registered</p>
        </div>
        <div className="flex gap-2">
          <a 
            href="/register" 
            target="_blank"
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            Registration Link
          </a>
          <button 
            onClick={() => {
              setFamilyForm({ name: '', phone: '', email: '', parentName: '' });
              setShowAddFamilyModal(true);
              setError('');
            }}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
          + Add Family
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2"
        >
          <span>📥</span>
          <span>Import CSV</span>
        </button>
        </div>
      </div>

      {/* Import Modal */}
      <CSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        importType="families"
        token={token}
        onSuccess={fetchFamilies}
      />

      {/* Search Bar */}
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Search families by name, phone, email, or child name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 pl-10 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {filteredFamilies.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 border border-slate-700 text-center">
          {searchTerm ? (
            <>
              <p className="text-slate-400 mb-4">No families match "{searchTerm}"</p>
              <button
                onClick={() => setSearchTerm('')}
                className="text-emerald-400 hover:text-emerald-300"
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="text-slate-400 mb-4">No families registered yet</p>
              <a 
                href="/register" 
                target="_blank"
                className="text-emerald-400 hover:text-emerald-300"
              >
                Register your first family →
              </a>
            </>
          )}
        </div>
      ) : (
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {searchTerm && (
          <div className="px-6 py-3 bg-slate-700/50 border-b border-slate-700 text-sm text-slate-400">
            Showing {filteredFamilies.length} of {families.length} families
          </div>
        )}
        <table className="w-full">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left text-slate-300 px-6 py-4 font-semibold">Family Name</th>
              <th className="text-left text-slate-300 px-6 py-4 font-semibold">Phone</th>
              <th className="text-left text-slate-300 px-6 py-4 font-semibold">Children</th>
              <th className="text-left text-slate-300 px-6 py-4 font-semibold">Total Check-ins</th>
              <th className="text-right text-slate-300 px-6 py-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
              {filteredFamilies.map((family) => {
                const familyCheckins = family.children?.reduce((s, c) => s + (c.totalCheckins || 0), 0) || 0;
              return (
                <tr key={family.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                  <td className="px-6 py-4 text-white font-medium">{family.name}</td>
                    <td className="px-6 py-4 text-slate-300">{formatPhone(family.phone)}</td>
                  <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {family.children?.map((child) => {
                          const initials = (child.first_name?.[0] || '') + (child.last_name?.[0] || child.name?.[0] || '');
                          return (
                            <div 
                              key={child.id}
                              title={child.name}
                              className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold"
                            >
                              {initials.toUpperCase()}
                            </div>
                          );
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{familyCheckins}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                        onClick={() => setSelectedFamily(family)}
                      className="text-emerald-400 hover:text-emerald-300 mr-4"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* Family Detail Modal */}
      {selectedFamily && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-3xl w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
            {/* Family Header */}
            <div className="flex justify-between items-start mb-6">
              {editingFamily ? (
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={familyForm.name}
                    onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })}
                    placeholder="Family Name"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-xl font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="tel"
                      value={familyForm.phone}
                      onChange={(e) => setFamilyForm({ ...familyForm, phone: e.target.value })}
                      placeholder="Phone Number"
                      className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="email"
                      value={familyForm.email}
                      onChange={(e) => setFamilyForm({ ...familyForm, email: e.target.value })}
                      placeholder="Email (optional)"
                      className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={familyForm.parentName}
                    onChange={(e) => setFamilyForm({ ...familyForm, parentName: e.target.value })}
                    placeholder="Parent Name (optional)"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                  {error && <p className="text-red-400 text-sm">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveFamily}
                      disabled={saving}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingFamily(false)}
                      className="px-4 py-2 text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedFamily.name}</h3>
                  <p className="text-slate-400">{formatPhone(selectedFamily.phone)}</p>
                  {selectedFamily.email && (
                    <p className="text-slate-400 text-sm">{selectedFamily.email}</p>
                  )}
                  {selectedFamily.parent_name && (
                    <p className="text-slate-400 text-sm">Parent: {selectedFamily.parent_name}</p>
                  )}
                  <button
                    onClick={handleEditFamily}
                    className="mt-2 text-emerald-400 hover:text-emerald-300 text-sm"
                  >
                    ✏️ Edit Family Info
                  </button>
              </div>
              )}
              <button 
                onClick={() => {
                  setSelectedFamily(null);
                  setEditingFamily(false);
                  setEditingChild(null);
                  setAddingChild(false);
                }}
                className="text-slate-400 hover:text-white text-2xl ml-4"
              >
                ×
              </button>
            </div>
            
            {/* Children Section */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-white">Children</h4>
              <button
                onClick={handleAddChild}
                className="px-3 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm"
              >
                + Add Child
              </button>
            </div>
            
            {/* Add Child Form */}
            {addingChild && (
              <div className="bg-slate-700 rounded-xl p-4 mb-4 border-2 border-emerald-500">
                <h5 className="text-white font-semibold mb-3">Add New Child</h5>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={childForm.first_name}
                    onChange={(e) => setChildForm({ ...childForm, first_name: e.target.value })}
                    placeholder="First Name *"
                    className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={childForm.last_name}
                    onChange={(e) => setChildForm({ ...childForm, last_name: e.target.value })}
                    placeholder="Last Name"
                    className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Birthday</label>
                    <input
                      type="date"
                      value={childForm.birthday}
                      onChange={(e) => setChildForm({ ...childForm, birthday: e.target.value })}
                      className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Gender</label>
                    <select
                      value={childForm.gender}
                      onChange={(e) => setChildForm({ ...childForm, gender: e.target.value })}
                      className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={childForm.pin}
                        onChange={(e) => setChildForm({ ...childForm, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        placeholder="PIN (MMDDYY)"
                        maxLength={6}
                        className="flex-1 bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                      />
                      {childForm.birthday && (
                        <button
                          type="button"
                          onClick={() => setChildForm({ ...childForm, pin: generatePinFromBirthday(childForm.birthday) })}
                          className="text-xs text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
                        >
                          Use birthday (MMDDYY)
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={childForm.allergies}
                    onChange={(e) => setChildForm({ ...childForm, allergies: e.target.value })}
                    placeholder="Allergies"
                    className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <textarea
                  value={childForm.notes}
                  onChange={(e) => setChildForm({ ...childForm, notes: e.target.value })}
                  placeholder="Notes"
                  rows={2}
                  className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 mb-3"
                />
                {/* Avatar preview */}
                <div className="mb-3">
                  <p className="text-slate-300 text-sm mb-2">Avatar:</p>
                  <img src={getAvatarUrl()} alt="Avatar" className="w-12 h-12 rounded-lg" />
                </div>
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNewChild}
                    disabled={saving}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {saving ? 'Adding...' : 'Add Child'}
                  </button>
                  <button
                    onClick={() => { setAddingChild(false); setError(''); }}
                    className="px-4 py-2 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {/* Children List */}
            <div className="space-y-4">
              {selectedFamily.children?.map((child) => (
                <div key={child.id} className="bg-slate-700 rounded-xl p-4">
                  {editingChild === child.id ? (
                    /* Edit Child Form */
                    <div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <input
                          type="text"
                          value={childForm.first_name}
                          onChange={(e) => setChildForm({ ...childForm, first_name: e.target.value })}
                          placeholder="First Name *"
                          className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                        />
                        <input
                          type="text"
                          value={childForm.last_name}
                          onChange={(e) => setChildForm({ ...childForm, last_name: e.target.value })}
                          placeholder="Last Name"
                          className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-slate-400 text-xs mb-1">Birthday</label>
                          <input
                            type="date"
                            value={childForm.birthday}
                            onChange={(e) => setChildForm({ ...childForm, birthday: e.target.value })}
                            className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-xs mb-1">Gender</label>
                          <select
                            value={childForm.gender}
                            onChange={(e) => setChildForm({ ...childForm, gender: e.target.value })}
                            className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">Select...</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={childForm.pin}
                              onChange={(e) => setChildForm({ ...childForm, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                              placeholder="PIN (MMDDYY)"
                              maxLength={6}
                              className="flex-1 bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                            />
                            {childForm.birthday && (
                              <button
                                type="button"
                                onClick={() => setChildForm({ ...childForm, pin: generatePinFromBirthday(childForm.birthday) })}
                                className="text-xs text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
                              >
                                Use birthday
                              </button>
                            )}
                          </div>
                        </div>
                        <input
                          type="text"
                          value={childForm.allergies}
                          onChange={(e) => setChildForm({ ...childForm, allergies: e.target.value })}
                          placeholder="Allergies"
                          className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <textarea
                        value={childForm.notes}
                        onChange={(e) => setChildForm({ ...childForm, notes: e.target.value })}
                        placeholder="Notes"
                        rows={2}
                        className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 mb-3"
                      />
                      {/* Avatar preview */}
                      <div className="mb-3">
                        <p className="text-slate-300 text-sm mb-2">Avatar:</p>
                        <img src={getAvatarUrl()} alt="Avatar" className="w-12 h-12 rounded-lg" />
                      </div>
                      
                      {/* Pending Rewards Section */}
                      <div className="mb-3 p-3 bg-slate-600/50 rounded-lg border border-slate-500">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-slate-300 text-sm font-medium">🎁 Rewards for Next Check-in</p>
                          <button
                            type="button"
                            onClick={() => setShowAddRewardModal(true)}
                            className="text-xs bg-emerald-500 text-white px-2 py-1 rounded hover:bg-emerald-600"
                          >
                            + Add Reward
                          </button>
                        </div>
                        
                        {pendingRewards.length === 0 ? (
                          <p className="text-slate-400 text-xs">No pending rewards. Add one to surprise them on their next check-in!</p>
                        ) : (
                          <div className="space-y-2">
                            {pendingRewards.map((reward) => (
                              <div key={reward.id} className="flex items-center justify-between bg-slate-700 rounded px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{reward.custom_icon || '🎁'}</span>
                                  <div>
                                    <p className="text-white text-sm">{reward.custom_name || 'Reward'}</p>
                                    <p className="text-slate-400 text-xs">{reward.custom_description || 'Special reward'}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePendingReward(editingChild, reward.id)}
                                  className="text-red-400 hover:text-red-300 text-sm"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Add Reward Modal */}
                        {showAddRewardModal && (
                          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddRewardModal(false)}>
                            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700" onClick={e => e.stopPropagation()}>
                              <h3 className="text-lg font-bold text-white mb-4">🎁 Add Reward for Next Check-in</h3>
                              
                              <div className="mb-4">
                                <label className="block text-slate-300 text-sm mb-2">Reward Name *</label>
                                <input
                                  type="text"
                                  value={newReward.custom_name}
                                  onChange={(e) => setNewReward({ ...newReward, custom_name: e.target.value })}
                                  placeholder="e.g., Special Prize, Extra Points"
                                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                />
                              </div>
                              
                              <div className="mb-4">
                                <label className="block text-slate-300 text-sm mb-2">Description / Prize</label>
                                <input
                                  type="text"
                                  value={newReward.custom_description}
                                  onChange={(e) => setNewReward({ ...newReward, custom_description: e.target.value })}
                                  placeholder="e.g., Pick from treasure box"
                                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                />
                              </div>
                              
                              <div className="mb-4">
                                <label className="block text-slate-300 text-sm mb-2">Icon</label>
                                <div className="flex gap-2 flex-wrap">
                                  {['🎁', '⭐', '🏆', '🎉', '🌟', '💫', '🎈', '🍭', '🍪', '🎮'].map((icon) => (
                                    <button
                                      key={icon}
                                      type="button"
                                      onClick={() => setNewReward({ ...newReward, custom_icon: icon })}
                                      className={`text-2xl p-2 rounded-lg ${
                                        newReward.custom_icon === icon 
                                          ? 'bg-emerald-500/30 ring-2 ring-emerald-400' 
                                          : 'bg-slate-700 hover:bg-slate-600'
                                      }`}
                                    >
                                      {icon}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  onClick={() => setShowAddRewardModal(false)}
                                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddPendingReward(editingChild)}
                                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
                                >
                                  Add Reward
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveChild}
                          disabled={saving}
                          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => { setEditingChild(null); setError(''); }}
                          className="px-4 py-2 text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Child */
                    <>
                      <div className="flex items-center gap-4">
                        <img 
                          src={getAvatarUrl()} 
                          alt={child.name}
                          className="w-14 h-14 rounded-full bg-slate-600"
                        />
                    <div className="flex-1">
                      <p className="text-white font-semibold text-lg">{child.name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-400 text-sm">
                            {(child.birthday || child.age) && (
                              <span>Age {calculateAge(child.birthday) ?? child.age}</span>
                            )}
                            {child.gender && <span className="capitalize">{child.gender}</span>}
                            {child.pin && <span>PIN: {child.pin}</span>}
                    </div>
                          {child.allergies && (
                            <p className="text-amber-400 text-sm mt-1">⚠️ Allergies: {child.allergies}</p>
                          )}
                          {child.notes && (
                            <p className="text-slate-400 text-sm mt-1">📝 {child.notes}</p>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                            <p className="text-xl font-bold text-orange-400">{child.streak || 0}</p>
                            <p className="text-slate-400 text-xs">Streak</p>
                      </div>
                      <div>
                            <p className="text-xl font-bold text-yellow-400">{child.badges || 0}</p>
                            <p className="text-slate-400 text-xs">Badges</p>
                      </div>
                      <div>
                            <p className="text-xl font-bold text-emerald-400">{child.totalCheckins || 0}</p>
                            <p className="text-slate-400 text-xs">Check-ins</p>
                      </div>
                    </div>
                  </div>
                      
                      {/* Quick Actions */}
                      <div className="flex gap-3 mt-3 pt-3 border-t border-slate-600">
                        <button
                          onClick={() => handleEditChild(child)}
                          className="text-emerald-400 hover:text-emerald-300 text-sm"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteChild(child.id, child.name)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          🗑️ Delete
                        </button>
            </div>
            
                    </>
                  )}
                </div>
              ))}
              
              {(!selectedFamily.children || selectedFamily.children.length === 0) && !addingChild && (
                <p className="text-slate-400 text-center py-4">No children in this family yet.</p>
              )}
            </div>
            
            <div className="mt-6 flex justify-end gap-4 pt-4 border-t border-slate-700">
              <button 
                onClick={() => handleDeleteFamily(selectedFamily.id)}
                className="px-4 py-2 text-red-400 hover:text-red-300"
              >
                Delete Family
              </button>
              <button 
                onClick={() => {
                  setSelectedFamily(null);
                  setEditingFamily(false);
                  setEditingChild(null);
                  setAddingChild(false);
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Family Modal */}
      {showAddFamilyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold text-white">Add New Family</h3>
              <button 
                onClick={() => { setShowAddFamilyModal(false); setError(''); }}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-2">Family Name *</label>
                <input
                  type="text"
                  value={familyForm.name}
                  onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })}
                  placeholder="e.g., The Smith Family"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={familyForm.phone}
                  onChange={(e) => setFamilyForm({ ...familyForm, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">Email (optional)</label>
                <input
                  type="email"
                  value={familyForm.email}
                  onChange={(e) => setFamilyForm({ ...familyForm, email: e.target.value })}
                  placeholder="family@email.com"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">Parent Name (optional)</label>
                <input
                  type="text"
                  value={familyForm.parentName}
                  onChange={(e) => setFamilyForm({ ...familyForm, parentName: e.target.value })}
                  placeholder="John & Jane Smith"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              
              {error && <p className="text-red-400 text-sm">{error}</p>}
              
              <p className="text-slate-400 text-sm">
                After creating the family, you can add children from the family detail view.
              </p>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddFamilyModal(false); setError(''); }}
                className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewFamily}
                disabled={saving || !familyForm.name.trim() || !familyForm.phone.trim()}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Creating...' : 'Create Family'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// ATTENDANCE TAB
// ============================================

function AttendanceTab({ token }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart'); // 'chart' or 'table'

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setAttendance(data.attendance || []);
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ['Date', 'Day', 'Check-ins'];
    const rows = attendance.map(record => {
      const date = new Date(record.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      return [record.date, dayName, record.count];
    });
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export to Excel (using CSV with .xlsx extension - basic compatibility)
  const exportExcel = () => {
    const headers = ['Date', 'Day', 'Check-ins'];
    const rows = attendance.map(record => {
      const date = new Date(record.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      return [record.date, dayName, record.count];
    });
    
    // Create a simple XML spreadsheet format that Excel can open
    let excelContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Attendance">
<Table>
<Row>
${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}
</Row>
${rows.map(row => `<Row>
${row.map((cell, i) => `<Cell><Data ss:Type="${i === 2 ? 'Number' : 'String'}">${cell}</Data></Cell>`).join('')}
</Row>`).join('\n')}
</Table>
</Worksheet>
</Workbook>`;
    
    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export to PDF (using browser print)
  const exportPDF = () => {
    const printWindow = window.open('', '_blank');
    const totalCheckins = attendance.reduce((sum, r) => sum + r.count, 0);
    const avgCheckins = attendance.length > 0 ? Math.round(totalCheckins / attendance.length) : 0;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attendance Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { color: #10b981; margin-bottom: 10px; }
          .subtitle { color: #666; margin-bottom: 30px; }
          .stats { display: flex; gap: 40px; margin-bottom: 30px; }
          .stat { background: #f3f4f6; padding: 20px; border-radius: 8px; }
          .stat-value { font-size: 32px; font-weight: bold; color: #10b981; }
          .stat-label { color: #666; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #1e293b; color: white; text-align: left; padding: 12px; }
          td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background: #f9fafb; }
          .footer { margin-top: 40px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>Adventure Kids Attendance Report</h1>
        <p class="subtitle">Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-value">${totalCheckins}</div>
            <div class="stat-label">Total Check-ins</div>
          </div>
          <div class="stat">
            <div class="stat-value">${avgCheckins}</div>
            <div class="stat-label">Average per Day</div>
          </div>
          <div class="stat">
            <div class="stat-value">${attendance.length}</div>
            <div class="stat-label">Days Recorded</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Check-ins</th>
            </tr>
          </thead>
          <tbody>
            ${attendance.map(record => {
              const date = new Date(record.date);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
              return `<tr>
                <td>${record.date}</td>
                <td>${dayName}</td>
                <td><strong>${record.count}</strong></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        
        <p class="footer">Adventure Kids Check-In System</p>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Calculate chart data
  const maxCount = Math.max(...attendance.map(r => r.count), 1);
  const totalCheckins = attendance.reduce((sum, r) => sum + r.count, 0);
  const avgCheckins = attendance.length > 0 ? Math.round(totalCheckins / attendance.length) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading attendance...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with title and controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white">Attendance History</h2>
        
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'chart' 
                  ? 'bg-emerald-500 text-white' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              📊 Chart
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'table' 
                  ? 'bg-emerald-500 text-white' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              📋 Table
            </button>
          </div>
          
          {/* Export Buttons */}
          {attendance.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
                title="Export as CSV"
              >
                CSV
              </button>
              <button
                onClick={exportExcel}
                className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
                title="Export as Excel"
              >
                Excel
              </button>
              <button
                onClick={exportPDF}
                className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
                title="Export as PDF"
              >
                PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      {attendance.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Total Check-ins</p>
            <p className="text-3xl font-bold text-emerald-400">{totalCheckins}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Average per Day</p>
            <p className="text-3xl font-bold text-blue-400">{avgCheckins}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Days Recorded</p>
            <p className="text-3xl font-bold text-purple-400">{attendance.length}</p>
          </div>
        </div>
      )}
      
      {attendance.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 border border-slate-700 text-center">
          <p className="text-slate-400">No check-ins recorded yet</p>
        </div>
      ) : viewMode === 'chart' ? (
        /* Chart View */
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-end gap-2 h-64">
            {attendance.slice(-30).map((record, i) => {
              const height = (record.count / maxCount) * 100;
              const date = new Date(record.date);
              const dayShort = date.toLocaleDateString('en-US', { weekday: 'short' });
              const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center group">
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded mb-1 whitespace-nowrap">
                    {monthDay}: {record.count} check-ins
                  </div>
                  
                  {/* Bar */}
                  <div 
                    className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all hover:from-emerald-500 hover:to-emerald-300 cursor-pointer"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  
                  {/* Label */}
                  <div className="mt-2 text-center">
                    <p className="text-slate-500 text-xs">{dayShort}</p>
                    <p className="text-slate-400 text-xs font-medium">{record.count}</p>
                  </div>
                </div>
              );
            })}
          </div>
          
          {attendance.length > 30 && (
            <p className="text-slate-500 text-sm text-center mt-4">
              Showing last 30 days. View table for complete history.
            </p>
          )}
        </div>
      ) : (
        /* Table View */
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left text-slate-300 px-6 py-4 font-semibold">Date</th>
                <th className="text-left text-slate-300 px-6 py-4 font-semibold">Day</th>
              <th className="text-left text-slate-300 px-6 py-4 font-semibold">Check-ins</th>
            </tr>
          </thead>
          <tbody>
              {attendance.map((record, i) => {
                const date = new Date(record.date);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
              return (
                <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/50">
                  <td className="px-6 py-4 text-white font-medium">{record.date}</td>
                    <td className="px-6 py-4 text-slate-300">{dayName}</td>
                  <td className="px-6 py-4 text-emerald-400 font-semibold">{record.count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

// ============================================
// VOLUNTEERS TAB
// ============================================

function VolunteersTab({ token }) {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [editingVolunteer, setEditingVolunteer] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Compliance state
  const [compliance, setCompliance] = useState({
    livescan_completed: false,
    livescan_date: '',
    mandatory_reporting_completed: false,
    mandatory_reporting_date: '',
    notes: ''
  });
  const [savingCompliance, setSavingCompliance] = useState(false);
  
  const [volunteerForm, setVolunteerForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    pin: ''
  });

  useEffect(() => {
    fetchVolunteers();
  }, []);

  const fetchVolunteers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/volunteers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setVolunteers(data);
    } catch (err) {
      console.error('Error fetching volunteers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompliance = async (volunteerId) => {
    try {
      const response = await fetch(`${API_BASE}/api/volunteer-compliance/${volunteerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCompliance({
          livescan_completed: data.livescan_completed || false,
          livescan_date: data.livescan_date || '',
          mandatory_reporting_completed: data.mandatory_reporting_completed || false,
          mandatory_reporting_date: data.mandatory_reporting_date || '',
          notes: data.notes || ''
        });
      }
    } catch (err) {
      console.error('Error fetching compliance:', err);
    }
  };

  const handleSaveCompliance = async () => {
    if (!selectedVolunteer?.child_id) return;
    
    setSavingCompliance(true);
    try {
      await fetch(`${API_BASE}/api/volunteer-compliance/${selectedVolunteer.child_id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(compliance)
      });
    } catch (err) {
      console.error('Error saving compliance:', err);
    } finally {
      setSavingCompliance(false);
    }
  };

  // Fetch compliance when volunteer is selected
  useEffect(() => {
    if (selectedVolunteer?.child_id) {
      fetchCompliance(selectedVolunteer.child_id);
    }
  }, [selectedVolunteer?.child_id]);

  const formatPhone = (phone) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 10) {
      return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    return phone;
  };

  const handleEditVolunteer = () => {
    setVolunteerForm({
      first_name: selectedVolunteer.first_name || '',
      last_name: selectedVolunteer.last_name || '',
      phone: selectedVolunteer.phone || '',
      email: selectedVolunteer.email || '',
      pin: selectedVolunteer.pin || ''
    });
    setEditingVolunteer(true);
    setError('');
  };

  const handleSaveVolunteer = async () => {
    if (!volunteerForm.first_name.trim() || !volunteerForm.last_name.trim()) {
      setError('First and last name are required');
      return;
    }
    if (!volunteerForm.phone.trim()) {
      setError('Phone number is required');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      // Update the family info
      const familyResponse = await fetch(`${API_BASE}/api/family/${selectedVolunteer.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: `${volunteerForm.first_name} ${volunteerForm.last_name} (Volunteer)`,
          phone: volunteerForm.phone.replace(/\D/g, ''),
          email: volunteerForm.email,
          parentName: `${volunteerForm.first_name} ${volunteerForm.last_name}`
        })
      });
      
      if (!familyResponse.ok) {
        throw new Error('Failed to update volunteer');
      }
      
      // Update the child record (volunteer's check-in profile)
      if (selectedVolunteer.child_id) {
        await fetch(`${API_BASE}/api/child/${selectedVolunteer.child_id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({
            first_name: volunteerForm.first_name,
            last_name: volunteerForm.last_name,
            pin: volunteerForm.pin
          })
        });
      }
      
      await fetchVolunteers();
      setSelectedVolunteer({
        ...selectedVolunteer,
        ...volunteerForm,
        volunteer_name: `${volunteerForm.first_name} ${volunteerForm.last_name}`
      });
      setEditingVolunteer(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddVolunteer = async () => {
    if (!volunteerForm.first_name.trim() || !volunteerForm.last_name.trim()) {
      setError('First and last name are required');
      return;
    }
    if (!volunteerForm.phone.trim()) {
      setError('Phone number is required');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      // Create family entry
      const familyResponse = await fetch(`${API_BASE}/api/family`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: `${volunteerForm.first_name} ${volunteerForm.last_name} (Volunteer)`,
          phone: volunteerForm.phone.replace(/\D/g, ''),
          email: volunteerForm.email,
          parentName: `${volunteerForm.first_name} ${volunteerForm.last_name}`
        })
      });
      
      if (!familyResponse.ok) {
        const err = await familyResponse.json();
        throw new Error(err.error || 'Failed to create volunteer');
      }
      
      const family = await familyResponse.json();
      
      // Create child entry (volunteer's check-in profile)
      await fetch(`${API_BASE}/api/family/${family.id}/child`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          first_name: volunteerForm.first_name,
          last_name: volunteerForm.last_name,
          pin: volunteerForm.pin || Math.floor(100000 + Math.random() * 900000).toString(),
          avatar: 'explorer',
          notes: 'Volunteer'
        })
      });
      
      await fetchVolunteers();
      setShowAddModal(false);
      setVolunteerForm({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        pin: ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVolunteer = async (volunteerId) => {
    if (!confirm('Are you sure you want to delete this volunteer? This cannot be undone.')) {
      return;
    }
    
    try {
      await fetch(`${API_BASE}/api/family/${volunteerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setVolunteers(volunteers.filter(v => v.id !== volunteerId));
      setSelectedVolunteer(null);
    } catch (err) {
      console.error('Error deleting volunteer:', err);
      alert('Failed to delete volunteer');
    }
  };

  const filteredVolunteers = volunteers.filter(v => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      v.volunteer_name?.toLowerCase().includes(search) ||
      v.phone?.includes(search) ||
      v.email?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading volunteers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Volunteers</h1>
          <p className="text-slate-400">{volunteers.length} volunteers registered</p>
        </div>
        <button
          onClick={() => {
            setVolunteerForm({
              first_name: '',
              last_name: '',
              phone: '',
              email: '',
              pin: ''
            });
            setError('');
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-2"
        >
          <span>➕</span>
          <span>Add Volunteer</span>
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2"
        >
          <span>📥</span>
          <span>Import CSV</span>
        </button>
      </div>

      {/* Import Modal */}
      <CSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        importType="volunteers"
        token={token}
        onSuccess={fetchVolunteers}
      />

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search volunteers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 pl-10 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Volunteer List */}
        <div className="lg:col-span-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="font-semibold text-white">All Volunteers</h2>
          </div>
          <div className="divide-y divide-slate-700 max-h-[600px] overflow-y-auto">
            {filteredVolunteers.map((volunteer) => (
              <button
                key={volunteer.id}
                onClick={() => {
                  setSelectedVolunteer(volunteer);
                  setEditingVolunteer(false);
                }}
                className={`w-full p-4 text-left hover:bg-slate-700/50 transition-colors ${
                  selectedVolunteer?.id === volunteer.id ? 'bg-slate-700/50' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium truncate">{volunteer.volunteer_name}</p>
                    {volunteer.is_also_parent && (
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">Parent</span>
                    )}
                  </div>
                  <span className="text-emerald-400 text-sm font-medium">{volunteer.totalCheckins || 0} shifts</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{formatPhone(volunteer.phone)}</span>
                  {volunteer.service_area && (
                    <span className="text-slate-500 truncate ml-2">{volunteer.service_area}</span>
                  )}
                </div>
                {volunteer.serving_frequency && (
                  <p className="text-slate-500 text-xs mt-1">{volunteer.serving_frequency}</p>
                )}
              </button>
            ))}
            {filteredVolunteers.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                {searchTerm ? 'No volunteers match your search' : 'No volunteers yet'}
              </div>
            )}
          </div>
        </div>

        {/* Volunteer Detail */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700">
          {selectedVolunteer ? (
            <div className="p-6">
              {!editingVolunteer ? (
                <>
                  {/* View Mode */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-2xl font-bold text-white">{selectedVolunteer.volunteer_name}</h2>
                        {selectedVolunteer.is_also_parent && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">Also a Parent</span>
                        )}
                      </div>
                      <p className="text-slate-400">{formatPhone(selectedVolunteer.phone)}</p>
                      {selectedVolunteer.email && (
                        <p className="text-slate-400 text-sm">{selectedVolunteer.email}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleEditVolunteer}
                        className="px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteVolunteer(selectedVolunteer.id)}
                        className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>

                  {/* Service Info */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <p className="text-slate-400 text-sm mb-1">Service Area</p>
                      <p className="text-white font-medium">{selectedVolunteer.service_area || 'Not assigned'}</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <p className="text-slate-400 text-sm mb-1">Serving Frequency</p>
                      <p className="text-white font-medium">{selectedVolunteer.serving_frequency || 'Not set'}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-emerald-400">{selectedVolunteer.totalCheckins || 0}</p>
                      <p className="text-slate-400 text-sm">Shifts Served</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                      <p className="text-lg font-medium text-slate-300">{selectedVolunteer.start_date || 'Unknown'}</p>
                      <p className="text-slate-400 text-sm">Start Date</p>
                    </div>
                  </div>

                  {/* PIN */}
                  <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
                    <p className="text-slate-400 text-sm mb-1">Check-in PIN</p>
                    <p className="text-2xl font-mono text-white tracking-wider">{selectedVolunteer.pin || 'Not set'}</p>
                  </div>

                  {/* Compliance Section */}
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <span>🛡️</span> Compliance & Background Checks
                    </h3>
                    
                    <div className="space-y-4">
                      {/* LiveScan */}
                      <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={compliance.livescan_completed}
                            onChange={(e) => setCompliance(prev => ({ 
                              ...prev, 
                              livescan_completed: e.target.checked,
                              livescan_date: e.target.checked && !prev.livescan_date ? new Date().toISOString().split('T')[0] : prev.livescan_date
                            }))}
                            className="w-5 h-5 rounded bg-slate-600 border-slate-500 text-emerald-500 focus:ring-emerald-500"
                          />
                          <div>
                            <p className="text-white font-medium">LiveScan / Background Check</p>
                            <p className="text-slate-400 text-xs">DOJ fingerprint background check</p>
                          </div>
                        </label>
                        {compliance.livescan_completed ? (
                          <span className="text-emerald-400 font-medium">✓ Complete</span>
                        ) : (
                          <span className="text-red-400 text-sm font-medium">Not Completed</span>
                        )}
                      </div>

                      {/* Mandatory Reporting */}
                      <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={compliance.mandatory_reporting_completed}
                            onChange={(e) => setCompliance(prev => ({ 
                              ...prev, 
                              mandatory_reporting_completed: e.target.checked,
                              mandatory_reporting_date: e.target.checked && !prev.mandatory_reporting_date ? new Date().toISOString().split('T')[0] : prev.mandatory_reporting_date
                            }))}
                            className="w-5 h-5 rounded bg-slate-600 border-slate-500 text-emerald-500 focus:ring-emerald-500"
                          />
                          <div>
                            <p className="text-white font-medium">Mandatory Reporting Training</p>
                            <p className="text-slate-400 text-xs">Child abuse reporting training</p>
                          </div>
                        </label>
                        {compliance.mandatory_reporting_completed ? (
                          <span className="text-emerald-400 font-medium">✓ Complete</span>
                        ) : (
                          <span className="text-red-400 text-sm font-medium">Not Completed</span>
                        )}
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-slate-400 text-sm mb-1">Compliance Notes</label>
                        <textarea
                          value={compliance.notes}
                          onChange={(e) => setCompliance(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Additional notes about certifications, training, etc."
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm resize-none"
                        />
                      </div>

                      {/* Save Button */}
                      <button
                        onClick={handleSaveCompliance}
                        disabled={savingCompliance}
                        className="w-full py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 text-sm font-medium"
                      >
                        {savingCompliance ? 'Saving...' : 'Save Compliance Status'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Edit Mode */}
                  <h2 className="text-xl font-bold text-white mb-4">Edit Volunteer</h2>
                  
                  {error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 mb-4 text-red-300 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">First Name</label>
                      <input
                        type="text"
                        value={volunteerForm.first_name}
                        onChange={(e) => setVolunteerForm({ ...volunteerForm, first_name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Last Name</label>
                      <input
                        type="text"
                        value={volunteerForm.last_name}
                        onChange={(e) => setVolunteerForm({ ...volunteerForm, last_name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Phone</label>
                      <input
                        type="tel"
                        value={volunteerForm.phone}
                        onChange={(e) => setVolunteerForm({ ...volunteerForm, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Email</label>
                      <input
                        type="email"
                        value={volunteerForm.email}
                        onChange={(e) => setVolunteerForm({ ...volunteerForm, email: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-slate-400 text-sm mb-1">PIN (6 digits)</label>
                    <input
                      type="text"
                      value={volunteerForm.pin}
                      onChange={(e) => setVolunteerForm({ ...volunteerForm, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="6-digit PIN"
                      maxLength={6}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono"
                    />
                  </div>

                  {/* Avatar Selection */}
                  <div className="mb-4">
                    <label className="block text-slate-400 text-sm mb-2">Avatar</label>
                    <div className="flex items-center gap-4">
                      <img
                        src={getAvatarUrl()}
                        alt=""
                        className="w-16 h-16 rounded-xl"
                      />
                      <p className="text-slate-400 text-sm">Explorer avatar (more options coming soon!)</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveVolunteer}
                      disabled={saving}
                      className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditingVolunteer(false)}
                      className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 text-center">
              <div>
                <p className="text-4xl mb-4">🙋</p>
                <p className="text-slate-400">Select a volunteer to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Volunteer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Add New Volunteer</h2>
            
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 mb-4 text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1">First Name *</label>
                <input
                  type="text"
                  value={volunteerForm.first_name}
                  onChange={(e) => setVolunteerForm({ ...volunteerForm, first_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Last Name *</label>
                <input
                  type="text"
                  value={volunteerForm.last_name}
                  onChange={(e) => setVolunteerForm({ ...volunteerForm, last_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-slate-400 text-sm mb-1">Phone *</label>
              <input
                type="tel"
                value={volunteerForm.phone}
                onChange={(e) => setVolunteerForm({ ...volunteerForm, phone: e.target.value })}
                placeholder="(714) 555-1234"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>

            <div className="mb-4">
              <label className="block text-slate-400 text-sm mb-1">Email</label>
              <input
                type="email"
                value={volunteerForm.email}
                onChange={(e) => setVolunteerForm({ ...volunteerForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>

            <div className="mb-4">
              <label className="block text-slate-400 text-sm mb-1">PIN (optional - will auto-generate)</label>
              <input
                type="text"
                value={volunteerForm.pin}
                onChange={(e) => setVolunteerForm({ ...volunteerForm, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                placeholder="6-digit PIN"
                maxLength={6}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddVolunteer}
                disabled={saving}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Volunteer'}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setError('');
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// REWARDS TAB
// ============================================

function RewardsTab({ token }) {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [editingReward, setEditingReward] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newReward, setNewReward] = useState({
    name: '',
    description: '',
    trigger_type: 'checkin_count',
    trigger_value: 10,
    prize: '',
    icon: '🎁'
  });

  useEffect(() => {
    fetchRewards();
    fetchStats();
  }, []);

  const fetchRewards = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/rewards`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setRewards(data);
    } catch (err) {
      console.error('Error fetching rewards:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/rewards/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching reward stats:', err);
    }
  };

  const toggleReward = async (rewardId) => {
    try {
      const response = await fetch(`${API_BASE}/api/rewards/${rewardId}/toggle`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setRewards(rewards.map(r => 
          r.id === rewardId ? { ...r, enabled: data.enabled ? 1 : 0 } : r
        ));
      }
    } catch (err) {
      console.error('Error toggling reward:', err);
    }
  };

  const updateReward = async (reward) => {
    try {
      await fetch(`${API_BASE}/api/rewards/${reward.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(reward)
      });
      setRewards(rewards.map(r => r.id === reward.id ? reward : r));
      setEditingReward(null);
    } catch (err) {
      console.error('Error updating reward:', err);
    }
  };

  const createReward = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/rewards`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(newReward)
      });
      const data = await response.json();
      if (data.success) {
        fetchRewards();
        setShowCreateModal(false);
        setNewReward({
          name: '',
          description: '',
          trigger_type: 'checkin_count',
          trigger_value: 10,
          prize: '',
          icon: '🎁'
        });
      }
    } catch (err) {
      console.error('Error creating reward:', err);
    }
  };

  const deleteReward = async (rewardId) => {
    if (!confirm('Are you sure you want to delete this reward?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/rewards/${rewardId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setRewards(rewards.filter(r => r.id !== rewardId));
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error('Error deleting reward:', err);
    }
  };

  const iconOptions = ['🎁', '🌟', '📚', '🎮', '👕', '🏆', '👑', '🔥', '⚡', '💎', '🎯', '🎪', '🎨', '🎵'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading rewards...</div>
      </div>
    );
  }

  // Group rewards by type
  const checkinRewards = rewards.filter(r => r.trigger_type === 'checkin_count');
  const streakRewards = rewards.filter(r => r.trigger_type === 'streak');
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">🎁 Reward Programs</h2>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
        >
          + Create Custom Reward
        </button>
      </div>

      <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <p className="text-slate-400 text-sm mb-1">Total Rewards Earned</p>
                <p className="text-2xl font-bold text-white">{stats.totalEarned}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <p className="text-slate-400 text-sm mb-1">Prizes to Claim</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.unclaimed}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <p className="text-slate-400 text-sm mb-1">Active Programs</p>
                <p className="text-2xl font-bold text-emerald-400">{rewards.filter(r => r.enabled).length}</p>
              </div>
            </div>
          )}

      {/* Attendance Milestones */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📈</span> Attendance Milestones
        </h3>
        <p className="text-slate-400 text-sm mb-4">Rewards earned when kids reach check-in milestones</p>
        
        <div className="space-y-3">
          {checkinRewards.map((reward) => (
            <div 
              key={reward.id} 
              className={`flex items-center gap-4 rounded-lg p-4 transition-all ${
                reward.enabled ? 'bg-slate-700' : 'bg-slate-700/40'
              }`}
            >
              <button
                onClick={() => toggleReward(reward.id)}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  reward.enabled ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  reward.enabled ? 'left-7' : 'left-1'
                }`} />
              </button>
              
              <span className="text-3xl">{reward.icon}</span>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`font-semibold ${reward.enabled ? 'text-white' : 'text-slate-500'}`}>
                    {reward.name}
                  </p>
                  {reward.is_preset === 1 && (
                    <span className="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded">Preset</span>
                  )}
                </div>
                <p className={`text-sm ${reward.enabled ? 'text-slate-400' : 'text-slate-600'}`}>
                  {reward.trigger_value} check-ins → {reward.prize}
                </p>
              </div>
              
              <button
                onClick={() => setEditingReward(reward)}
                className="text-slate-400 hover:text-white px-3 py-1"
              >
                Edit
              </button>
              
              {!reward.is_preset && (
                <button
                  onClick={() => deleteReward(reward.id)}
                  className="text-red-400 hover:text-red-300 px-3 py-1"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Streak Rewards */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🔥</span> Streak Rewards
        </h3>
        <p className="text-slate-400 text-sm mb-4">Rewards for maintaining consecutive week streaks</p>
        
        <div className="space-y-3">
          {streakRewards.map((reward) => (
            <div 
              key={reward.id} 
              className={`flex items-center gap-4 rounded-lg p-4 transition-all ${
                reward.enabled ? 'bg-slate-700' : 'bg-slate-700/40'
              }`}
            >
              <button
                onClick={() => toggleReward(reward.id)}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  reward.enabled ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  reward.enabled ? 'left-7' : 'left-1'
                }`} />
              </button>
              
              <span className="text-3xl">{reward.icon}</span>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`font-semibold ${reward.enabled ? 'text-white' : 'text-slate-500'}`}>
                    {reward.name}
                  </p>
                  {reward.is_preset === 1 && (
                    <span className="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded">Preset</span>
                  )}
                </div>
                <p className={`text-sm ${reward.enabled ? 'text-slate-400' : 'text-slate-600'}`}>
                  {reward.trigger_value}-week streak → {reward.prize}
                </p>
              </div>
              
              <button
                onClick={() => setEditingReward(reward)}
                className="text-slate-400 hover:text-white px-3 py-1"
              >
                Edit
              </button>
              
              {!reward.is_preset && (
                <button
                  onClick={() => deleteReward(reward.id)}
                  className="text-red-400 hover:text-red-300 px-3 py-1"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

          {/* Recent Earned Rewards */}
          {stats?.recentEarned?.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">🎉 Recently Earned</h3>
              <div className="space-y-2">
                {stats.recentEarned.map((earned, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-700/50 rounded-lg p-3">
                    <img 
                      src={getAvatarUrl()} 
                      alt={earned.child_name}
                      className="w-8 h-8 rounded-full bg-slate-600"
                    />
                    <div className="flex-1">
                      <p className="text-white text-sm">
                        <span className="font-semibold">{earned.child_name}</span> earned{' '}
                        <span className="text-yellow-400">{earned.icon} {earned.name}</span>
                      </p>
                      <p className="text-slate-500 text-xs">
                        {new Date(earned.earned_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>

      {/* Edit Modal */}
      {editingReward && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Edit Reward</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-1">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {iconOptions.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setEditingReward({ ...editingReward, icon })}
                      className={`w-10 h-10 text-xl rounded-lg transition-all ${
                        editingReward.icon === icon 
                          ? 'bg-emerald-500' 
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Name</label>
                <input
                  type="text"
                  value={editingReward.name}
                  onChange={(e) => setEditingReward({ ...editingReward, name: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Description</label>
                <textarea
                  value={editingReward.description || ''}
                  onChange={(e) => setEditingReward({ ...editingReward, description: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white h-20"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">
                  {editingReward.trigger_type === 'streak' ? 'Streak Weeks Required' : 'Check-ins Required'}
                </label>
                <input
                  type="number"
                  value={editingReward.trigger_value}
                  onChange={(e) => setEditingReward({ ...editingReward, trigger_value: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Prize</label>
                <input
                  type="text"
                  value={editingReward.prize || ''}
                  onChange={(e) => setEditingReward({ ...editingReward, prize: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  placeholder="e.g., Small toy from prize box"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingReward(null)}
                className="px-4 py-2 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => updateReward(editingReward)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Create Custom Reward</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-1">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {iconOptions.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setNewReward({ ...newReward, icon })}
                      className={`w-10 h-10 text-xl rounded-lg transition-all ${
                        newReward.icon === icon 
                          ? 'bg-emerald-500' 
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Reward Name</label>
                <input
                  type="text"
                  value={newReward.name}
                  onChange={(e) => setNewReward({ ...newReward, name: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  placeholder="e.g., Birthday Bonus"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Description</label>
                <textarea
                  value={newReward.description}
                  onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white h-20"
                  placeholder="Describe when this reward is earned"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Trigger Type</label>
                <select
                  value={newReward.trigger_type}
                  onChange={(e) => setNewReward({ ...newReward, trigger_type: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="checkin_count">Total Check-ins</option>
                  <option value="streak">Week Streak</option>
                </select>
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">
                  {newReward.trigger_type === 'streak' ? 'Weeks Required' : 'Check-ins Required'}
                </label>
                <input
                  type="number"
                  value={newReward.trigger_value}
                  onChange={(e) => setNewReward({ ...newReward, trigger_value: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Prize</label>
                <input
                  type="text"
                  value={newReward.prize}
                  onChange={(e) => setNewReward({ ...newReward, prize: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  placeholder="e.g., Free ice cream cone"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={createReward}
                disabled={!newReward.name || !newReward.trigger_value}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Reward
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// REPORTS TAB
// ============================================

function ReportsTab({ token }) {
  const [savedReports, setSavedReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState('attendance_summary');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    month: new Date().getMonth() + 1
  });

  useEffect(() => {
    fetchReportSchema();
    // Load attendance summary by default
    runReport('attendance_summary');
  }, []);

  const fetchReportSchema = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/reports/schema`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSavedReports(data.savedReports || []);
    } catch (err) {
      console.error('Error fetching report schema:', err);
    }
  };

  const runReport = async (reportId, customFilters = {}) => {
    setLoading(true);
    setSelectedReport(reportId);
    
    try {
      const response = await fetch(`${API_BASE}/api/reports/query`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          reportType: reportId,
          filters: { ...filters, ...customFilters }
        })
      });
      const data = await response.json();
      setReportData(data.data || []);
    } catch (err) {
      console.error('Error running report:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export functions
  const exportCSV = () => {
    if (reportData.length === 0) return;
    
    const headers = Object.keys(reportData[0]);
    const rows = reportData.map(row => headers.map(h => {
      const val = row[h];
      // Escape commas and quotes
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val ?? '';
    }));
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedReport}-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (reportData.length === 0) return;
    
    const headers = Object.keys(reportData[0]);
    
    let excelContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Report">
<Table>
<Row>
${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}
</Row>
${reportData.map(row => `<Row>
${headers.map(h => {
  const val = row[h];
  const type = typeof val === 'number' ? 'Number' : 'String';
  return `<Cell><Data ss:Type="${type}">${val ?? ''}</Data></Cell>`;
}).join('')}
</Row>`).join('\n')}
</Table>
</Worksheet>
</Workbook>`;
    
    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedReport}-report-${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (reportData.length === 0) return;
    
    const headers = Object.keys(reportData[0]);
    const reportInfo = savedReports.find(r => r.id === selectedReport);
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportInfo?.name || 'Report'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; font-size: 12px; }
          h1 { color: #10b981; margin-bottom: 5px; font-size: 24px; }
          .subtitle { color: #666; margin-bottom: 20px; }
          .meta { color: #999; font-size: 11px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #1e293b; color: white; text-align: left; padding: 8px; font-size: 10px; }
          td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background: #f9fafb; }
          .footer { margin-top: 30px; color: #999; font-size: 10px; }
        </style>
      </head>
      <body>
        <h1>${reportInfo?.name || 'Report'}</h1>
        <p class="subtitle">${reportInfo?.description || ''}</p>
        <p class="meta">Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | Records: ${reportData.length}</p>
        
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${reportData.slice(0, 500).map(row => `<tr>
              ${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
        ${reportData.length > 500 ? '<p class="meta">Showing first 500 records. Export to CSV/Excel for complete data.</p>' : ''}
        <p class="footer">Adventure Kids Check-In System</p>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getReportIcon = (id) => {
    const icons = {
      families: '👨‍👩‍👧‍👦',
      children: '👶',
      checkins: '✅',
      attendance_summary: '📊',
      rewards: '🏆',
      volunteers: '🙋',
      birthdays: '🎂',
      allergies: '⚠️'
    };
    return icons[id] || '📋';
  };

  const formatCellValue = (key, value) => {
    if (value === null || value === undefined) return '-';
    if (key.includes('date') || key.includes('_at')) {
      try {
        return new Date(value).toLocaleDateString('en-US', { 
          year: 'numeric', month: 'short', day: 'numeric',
          ...(key.includes('_at') ? { hour: 'numeric', minute: '2-digit' } : {})
        });
      } catch { return value; }
    }
    if (key === 'phone' && value) {
      const clean = value.toString().replace(/\D/g, '');
      if (clean.length === 10) {
        return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
      }
    }
    return value;
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Reports</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Report Selection Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Saved Reports</h3>
            
            <div className="space-y-2">
              {savedReports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => runReport(report.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    selectedReport === report.id
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getReportIcon(report.id)}</span>
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <p className={`text-xs ${selectedReport === report.id ? 'text-emerald-100' : 'text-slate-400'}`}>
                        {report.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Filters */}
            {selectedReport === 'checkins' && (
              <div className="mt-6 pt-4 border-t border-slate-600">
                <h4 className="text-sm font-medium text-slate-300 mb-3">Date Range</h4>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                    placeholder="Start date"
                  />
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                    placeholder="End date"
                  />
                  <button
                    onClick={() => runReport('checkins')}
                    className="w-full py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            )}

            {selectedReport === 'birthdays' && (
              <div className="mt-6 pt-4 border-t border-slate-600">
                <h4 className="text-sm font-medium text-slate-300 mb-3">Select Month</h4>
                <select
                  value={filters.month}
                  onChange={(e) => {
                    const month = parseInt(e.target.value);
                    setFilters(prev => ({ ...prev, month }));
                    runReport('birthdays', { month });
                  }}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                >
                  {['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Report Results */}
        <div className="lg:col-span-3">
          {!selectedReport ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
              <span className="text-6xl mb-4 block">📋</span>
              <h3 className="text-xl font-semibold text-white mb-2">Select a Report</h3>
              <p className="text-slate-400">Choose a report from the sidebar to view data</p>
            </div>
          ) : loading ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
              <div className="text-slate-400">Loading report...</div>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              {/* Report Header */}
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {savedReports.find(r => r.id === selectedReport)?.name}
                  </h3>
                  <p className="text-sm text-slate-400">{reportData.length} records found</p>
                </div>
                
                {reportData.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={exportCSV}
                      className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
                    >
                      CSV
                    </button>
                    <button
                      onClick={exportExcel}
                      className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
                    >
                      Excel
                    </button>
                    <button
                      onClick={exportPDF}
                      className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
                    >
                      PDF
                    </button>
                  </div>
                )}
              </div>

              {/* Report Table */}
              {reportData.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-slate-400">No data found for this report</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-slate-700 sticky top-0">
                      <tr>
                        {Object.keys(reportData[0]).map((key) => (
                          <th key={key} className="text-left text-slate-300 px-4 py-3 font-semibold text-sm whitespace-nowrap">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((row, i) => (
                        <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/50">
                          {Object.entries(row).map(([key, value], j) => (
                            <td key={j} className="px-4 py-3 text-slate-300 text-sm whitespace-nowrap">
                              {formatCellValue(key, value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// SETTINGS TAB
// ============================================

function SettingsTab({ logo, setLogo, token }) {
  const [orgName, setOrgName] = useState('Adventure Kids');
  const [tagline, setTagline] = useState('Check-In');
  const [rooms, setRooms] = useState([]);
  const [testPrintStatus, setTestPrintStatus] = useState(null);
  
  // Room editing state
  const [editingRoom, setEditingRoom] = useState(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({ name: '', age_range: '', capacity: '' });
  const [roomSaving, setRoomSaving] = useState(false);
  
  // User management state
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'admin' });
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState('');
  
  // Template state
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showLabelEditor, setShowLabelEditor] = useState(false);
  const [labelEditorTemplate, setLabelEditorTemplate] = useState(null);
  const [labelPreviewType, setLabelPreviewType] = useState('kid');
  const [labelPreviewUrl, setLabelPreviewUrl] = useState(null);
  const [labelPreviewLoading, setLabelPreviewLoading] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    day_of_week: '',
    start_time: '',
    end_time: '',
    checkout_enabled: false,
    room_ids: [],
    track_streaks: true,
    streak_reset_days: 7,
    print_volunteer_badges: true,
    label_settings: null
  });
  const [templateSaving, setTemplateSaving] = useState(false);
  
  // Default label settings
  const defaultLabelSettings = {
    kidLabel: {
      enabled: true,
      showAvatar: true,
      showName: true,
      showRoom: true,
      showStreak: true,
      showBadges: true,
      showRank: true,
      showPickupCode: true,
      showAllergies: true,
      showDate: true,
      nameSize: 110,
      roomSize: 44,
      accentColor: '#10B981',
      borderStyle: 'pointed',
    },
    parentLabel: {
      enabled: true,
      showLogo: false,
      showFamilyName: true,
      showChildren: true,
      showPickupCodes: true,
      showRooms: true,
      showDate: true,
      showTime: true,
      titleSize: 48,
      nameSize: 36,
      accentColor: '#3B82F6',
    },
    volunteerLabel: {
      enabled: true,
      showInitials: true,
      showName: true,
      showServiceArea: true,
      showDate: true,
      nameSize: 154,
      serviceAreaSize: 62,
      dateSize: 50,
      accentColor: '#4F46E5',
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchTemplates();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleAddUser = async () => {
    if (!userForm.username.trim() || !userForm.password.trim()) {
      setUserError('Username and password are required');
      return;
    }
    if (userForm.password.length < 6) {
      setUserError('Password must be at least 6 characters');
      return;
    }
    
    setUserSaving(true);
    setUserError('');
    
    try {
      const response = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(userForm)
      });
      
      if (response.ok) {
        await fetchUsers();
        setShowUserModal(false);
        setUserForm({ username: '', password: '', role: 'admin' });
      } else {
        const data = await response.json();
        setUserError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setUserError('Error creating user');
    }
    setUserSaving(false);
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await fetch(`${API_BASE}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/rooms`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setRooms(data);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: '',
      day_of_week: '',
      start_time: '',
      end_time: '',
      checkout_enabled: false,
      room_ids: rooms.map(r => r.id), // Default to all rooms selected
      track_streaks: true,
      streak_reset_days: 7,
      print_volunteer_badges: true,
      label_settings: { ...defaultLabelSettings }
    });
    setShowTemplateModal(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      day_of_week: template.day_of_week || '',
      start_time: template.start_time || '',
      end_time: template.end_time || '',
      checkout_enabled: template.checkout_enabled,
      room_ids: template.room_ids || [],
      track_streaks: template.track_streaks !== false,
      streak_reset_days: template.streak_reset_days || 7,
      print_volunteer_badges: template.print_volunteer_badges !== false,
      label_settings: template.label_settings || { ...defaultLabelSettings }
    });
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) return;
    
    setTemplateSaving(true);
    try {
      const url = editingTemplate 
        ? `${API_BASE}/api/templates/${editingTemplate.id}`
        : `${API_BASE}/api/templates`;
      
      const response = await fetch(url, {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: templateForm.name.trim(),
          day_of_week: templateForm.day_of_week || null,
          start_time: templateForm.start_time || null,
          end_time: templateForm.end_time || null,
          checkout_enabled: templateForm.checkout_enabled,
          room_ids: templateForm.room_ids,
          track_streaks: templateForm.track_streaks,
          streak_reset_days: templateForm.streak_reset_days,
          print_volunteer_badges: templateForm.print_volunteer_badges,
          label_settings: templateForm.label_settings
        })
      });
      
      if (response.ok) {
        await fetchTemplates();
        setShowTemplateModal(false);
        setEditingTemplate(null);
      }
    } catch (err) {
      console.error('Error saving template:', err);
    }
    setTemplateSaving(false);
  };

  // Open label editor for a template
  const handleOpenLabelEditor = (template) => {
    setLabelEditorTemplate(template);
    setTemplateForm(prev => ({
      ...prev,
      label_settings: template.label_settings || { ...defaultLabelSettings }
    }));
    setLabelPreviewType('kid');
    setShowLabelEditor(true);
    // Generate initial preview
    generateLabelPreview('kid', template.label_settings || defaultLabelSettings);
  };

  // Generate label preview
  const generateLabelPreview = async (type, settings) => {
    setLabelPreviewLoading(true);
    try {
      const labelSettings = settings || templateForm.label_settings || defaultLabelSettings;
      const settingsForType = type === 'kid' ? labelSettings.kidLabel 
        : type === 'parent' ? labelSettings.parentLabel 
        : labelSettings.volunteerLabel;
      
      const response = await fetch(`${API_BASE}/api/label-preview`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          labelType: type,
          settings: settingsForType,
          sampleData: type === 'kid' 
            ? { name: 'Sample Child', room: 'Kids Room', allergies: 'None' }
            : type === 'parent'
            ? { familyName: 'Sample Family', children: [{ name: 'Child One', pickupCode: 'ABC1', room: 'Room 1' }] }
            : { name: 'Sample Volunteer', serviceArea: 'Kids Ministry' }
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setLabelPreviewUrl(url);
      }
    } catch (err) {
      console.error('Error generating preview:', err);
    }
    setLabelPreviewLoading(false);
  };

  // Update label setting and regenerate preview
  const updateLabelSetting = (labelType, key, value) => {
    const newSettings = {
      ...templateForm.label_settings,
      [labelType]: {
        ...templateForm.label_settings[labelType],
        [key]: value
      }
    };
    setTemplateForm(prev => ({ ...prev, label_settings: newSettings }));
    
    // Regenerate preview after a short delay
    const previewType = labelType === 'kidLabel' ? 'kid' : labelType === 'parentLabel' ? 'parent' : 'volunteer';
    setTimeout(() => generateLabelPreview(previewType, newSettings), 300);
  };

  // Save label settings
  const handleSaveLabelSettings = async () => {
    if (!labelEditorTemplate) return;
    
    setTemplateSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/templates/${labelEditorTemplate.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          ...labelEditorTemplate,
          label_settings: templateForm.label_settings
        })
      });
      
      if (response.ok) {
        await fetchTemplates();
        setShowLabelEditor(false);
        setLabelEditorTemplate(null);
      }
    } catch (err) {
      console.error('Error saving label settings:', err);
    }
    setTemplateSaving(false);
  };

  const handleActivateTemplate = async (templateId) => {
    try {
      await fetch(`${API_BASE}/api/templates/${templateId}/activate`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchTemplates();
    } catch (err) {
      console.error('Error activating template:', err);
    }
  };

  const handleDeactivateTemplates = async () => {
    try {
      await fetch(`${API_BASE}/api/templates/deactivate`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchTemplates();
    } catch (err) {
      console.error('Error deactivating templates:', err);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/templates/${templateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        await fetchTemplates();
      }
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  const toggleRoomInTemplate = (roomId) => {
    setTemplateForm(prev => ({
      ...prev,
      room_ids: prev.room_ids.includes(roomId)
        ? prev.room_ids.filter(id => id !== roomId)
        : [...prev.room_ids, roomId]
    }));
  };

  const handleAddRoom = () => {
    setEditingRoom(null);
    setRoomForm({ name: '', age_range: '', capacity: '' });
    setShowRoomModal(true);
  };

  const handleEditRoom = (room) => {
    setEditingRoom(room);
    setRoomForm({ 
      name: room.name, 
      age_range: room.age_range || '', 
      capacity: room.capacity || '' 
    });
    setShowRoomModal(true);
  };

  const handleSaveRoom = async () => {
    if (!roomForm.name.trim()) return;
    
    setRoomSaving(true);
    try {
      const url = editingRoom 
        ? `${API_BASE}/api/rooms/${editingRoom.id}`
        : `${API_BASE}/api/rooms`;
      
      const response = await fetch(url, {
        method: editingRoom ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: roomForm.name.trim(),
          age_range: roomForm.age_range.trim() || null,
          capacity: roomForm.capacity ? parseInt(roomForm.capacity) : null
        })
      });
      
      if (response.ok) {
        await fetchRooms();
        setShowRoomModal(false);
        setEditingRoom(null);
        setRoomForm({ name: '', age_range: '', capacity: '' });
      }
    } catch (err) {
      console.error('Error saving room:', err);
    }
    setRoomSaving(false);
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('Are you sure you want to delete this room?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        await fetchRooms();
      }
    } catch (err) {
      console.error('Error deleting room:', err);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTestPrint = async () => {
    setTestPrintStatus('printing');
    try {
      const response = await fetch(`${API_BASE}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childName: 'Test Label',
          avatar: '🦊',
          pickupCode: 'TEST',
          room: 'Room 101',
          streak: 5,
          rank: 1,
          badges: 10,
          tier: 'bronze'
        })
      });
      
      if (response.ok) {
        setTestPrintStatus('success');
      } else {
        setTestPrintStatus('error');
      }
    } catch (err) {
      setTestPrintStatus('error');
    }
    
    setTimeout(() => setTestPrintStatus(null), 3000);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>
      
      {/* Branding */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Branding</h3>
        
        <div className="mb-6">
          <label className="block text-slate-300 mb-2">Logo</label>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 bg-slate-700 rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-600">
              {logo ? (
                <img src={logo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-slate-500 text-sm text-center px-2">No logo uploaded</span>
              )}
            </div>
            <div>
              <input
                type="file"
                accept="image/*,.svg"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
              />
              <label
                htmlFor="logo-upload"
                className="inline-block px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 cursor-pointer transition-colors"
              >
                Upload Logo
              </label>
              <p className="text-slate-400 text-sm mt-2">SVG, PNG or JPG (max 2MB)</p>
              {logo && (
                <button 
                  onClick={() => setLogo(null)}
                  className="text-red-400 text-sm mt-2 hover:text-red-300"
                >
                  Remove Logo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-slate-300 mb-2">Organization Name</label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-slate-300 mb-2">Tagline</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
          Save Branding
        </button>
      </div>

      {/* User Management */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">👤 Admin Users</h3>
          <button 
            onClick={() => {
              setUserForm({ username: '', password: '', role: 'admin' });
              setUserError('');
              setShowUserModal(true);
            }}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
          >
            + Add User
          </button>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          Manage admin accounts that can access this dashboard.
        </p>
        <div className="space-y-3">
          {users.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No additional users. Only the master admin account exists.</p>
          ) : (
            users.map((user) => (
              <div key={user.id} className="flex items-center justify-between bg-slate-700 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center text-white font-bold">
                    {user.username.charAt(0).toUpperCase()}
          </div>
                  <div>
                    <span className="text-white font-medium">{user.username}</span>
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                      user.role === 'superadmin' 
                        ? 'bg-purple-500/20 text-purple-300' 
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {user.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                    </span>
          </div>
          </div>
                {user.role !== 'superadmin' && (
                  <button 
                    onClick={() => handleDeleteUser(user.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Delete
                  </button>
                )}
          </div>
            ))
          )}
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Add New Admin User</h3>
            
            {userError && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 mb-4 text-red-400 text-sm">
                {userError}
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-slate-300 mb-2">Username *</label>
              <input
                type="text"
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                placeholder="Enter username"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-slate-300 mb-2">Password *</label>
              <input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="Minimum 6 characters"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-slate-300 mb-2">Role</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="admin">Admin</option>
                <option value="readonly">Read Only</option>
              </select>
              <p className="text-slate-500 text-xs mt-1">Admins can manage all settings. Read-only users can only view data.</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setUserForm({ username: '', password: '', role: 'admin' });
                  setUserError('');
                }}
                className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={userSaving}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {userSaving ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rooms */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Rooms</h3>
          <button 
            onClick={handleAddRoom}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
          >
            + Add Room
          </button>
        </div>
        <div className="space-y-3">
          {rooms.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No rooms configured yet. Add your first room!</p>
          ) : (
            rooms.map((room) => (
              <div key={room.id} className="flex items-center justify-between bg-slate-700 rounded-lg px-4 py-3">
                <div>
                  <span className="text-white font-medium">{room.name}</span>
                  {room.age_range && (
                    <span className="text-slate-400 text-sm ml-2">Ages {room.age_range}</span>
                  )}
                  {room.capacity && (
                    <span className="text-slate-500 text-sm ml-2">• Capacity: {room.capacity}</span>
                  )}
          </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEditRoom(room)}
                    className="text-emerald-400 hover:text-emerald-300 text-sm"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteRoom(room.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Delete
                  </button>
          </div>
          </div>
            ))
          )}
          </div>
        </div>

      {/* Room Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingRoom ? 'Edit Room' : 'Add New Room'}
            </h3>
            
            <div className="mb-4">
              <label className="block text-slate-300 mb-2">Room Name *</label>
              <input
                type="text"
                value={roomForm.name}
                onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                placeholder="e.g., Nursery, Kids Room 1"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              />
      </div>

            <div className="mb-4">
              <label className="block text-slate-300 mb-2">Age Range</label>
              <input
                type="text"
                value={roomForm.age_range}
                onChange={(e) => setRoomForm({ ...roomForm, age_range: e.target.value })}
                placeholder="e.g., 0-2, 3-5, 6-10"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-slate-300 mb-2">Capacity</label>
              <input
                type="number"
                value={roomForm.capacity}
                onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                placeholder="e.g., 20"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRoomModal(false);
                  setEditingRoom(null);
                  setRoomForm({ name: '', age_range: '', capacity: '' });
                }}
                className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoom}
                disabled={!roomForm.name.trim() || roomSaving}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {roomSaving ? 'Saving...' : (editingRoom ? 'Save Changes' : 'Add Room')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Event Templates</h3>
          <button 
            onClick={handleAddTemplate}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
          >
            + Create Template
          </button>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          Templates define which rooms are available during different events. 
          <span className="text-emerald-400"> Templates automatically activate based on their day and time settings!</span> 
          You can also manually activate a template to override auto-scheduling.
        </p>
        <div className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No templates configured yet. Create your first template!</p>
          ) : (
            templates.map((template) => (
              <div 
                key={template.id} 
                className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                  template.is_active 
                    ? 'bg-emerald-900/30 border border-emerald-500/50' 
                    : 'bg-slate-700'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{template.name}</span>
                    {template.is_active && (
                      <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">Active</span>
                    )}
                  </div>
                  <div className="text-slate-400 text-sm mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {template.day_of_week && (
                      <span className="capitalize">{template.day_of_week}</span>
                    )}
                    {template.start_time && template.end_time && (
                      <span>{template.start_time} - {template.end_time}</span>
                    )}
                    <span>
                      {template.room_ids.length} room{template.room_ids.length !== 1 ? 's' : ''}
                    </span>
                    {template.checkout_enabled && (
                      <span className="text-amber-400">Checkout enabled</span>
                    )}
                    {template.track_streaks && (
                      <span className="text-orange-400">🔥 Streaks ({template.streak_reset_days}d)</span>
                    )}
                    {template.print_volunteer_badges !== false && (
                      <span className="text-indigo-400">🏷️ Vol. badges</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {template.is_active ? (
                    <button 
                      onClick={handleDeactivateTemplates}
                      className="text-amber-400 hover:text-amber-300 text-sm"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleActivateTemplate(template.id)}
                      className="text-emerald-400 hover:text-emerald-300 text-sm"
                    >
                      Activate
                    </button>
                  )}
                  <button 
                    onClick={() => handleEditTemplate(template)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleOpenLabelEditor(template)}
                    className="text-indigo-400 hover:text-indigo-300 text-sm"
                  >
                    🏷️ Labels
                  </button>
                  <button 
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Label Editor Modal */}
      {showLabelEditor && labelEditorTemplate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-6xl border border-slate-700 max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Label Designer</h3>
                <p className="text-slate-400 text-sm">Customize labels for: {labelEditorTemplate.name}</p>
              </div>
              <button 
                onClick={() => { setShowLabelEditor(false); setLabelEditorTemplate(null); }}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-hidden flex">
              {/* Left: Settings */}
              <div className="w-1/2 border-r border-slate-700 overflow-y-auto p-4">
                {/* Label Type Tabs */}
                <div className="flex gap-2 mb-6">
                  {[
                    { id: 'kid', label: '👶 Kid Label', key: 'kidLabel' },
                    { id: 'parent', label: '👨‍👩‍👧 Parent Receipt', key: 'parentLabel' },
                    { id: 'volunteer', label: '🙋 Volunteer Badge', key: 'volunteerLabel' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setLabelPreviewType(tab.id); generateLabelPreview(tab.id); }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        labelPreviewType === tab.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Kid Label Settings */}
                {labelPreviewType === 'kid' && templateForm.label_settings?.kidLabel && (
                  <div className="space-y-4">
                    <h4 className="text-white font-semibold mb-3">Kid Check-in Label</h4>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={templateForm.label_settings.kidLabel.enabled}
                        onChange={(e) => updateLabelSetting('kidLabel', 'enabled', e.target.checked)}
                        className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500"
                      />
                      <span className="text-white">Print kid labels</span>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'showAvatar', label: 'Show Avatar' },
                        { key: 'showName', label: 'Show Name' },
                        { key: 'showRoom', label: 'Show Room' },
                        { key: 'showStreak', label: 'Show Streak' },
                        { key: 'showBadges', label: 'Show Badges' },
                        { key: 'showRank', label: 'Show Rank' },
                        { key: 'showPickupCode', label: 'Show Pickup Code' },
                        { key: 'showAllergies', label: 'Show Allergies' },
                        { key: 'showDate', label: 'Show Date' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={templateForm.label_settings.kidLabel[key]}
                            onChange={(e) => updateLabelSetting('kidLabel', key, e.target.checked)}
                            className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-emerald-500"
                          />
                          <span className="text-slate-300">{label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-slate-400 text-sm mb-1">Name Size</label>
                        <input
                          type="range"
                          min="60"
                          max="150"
                          value={templateForm.label_settings.kidLabel.nameSize}
                          onChange={(e) => updateLabelSetting('kidLabel', 'nameSize', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-slate-500 text-xs">{templateForm.label_settings.kidLabel.nameSize}px</span>
                      </div>
                      <div>
                        <label className="block text-slate-400 text-sm mb-1">Room Size</label>
                        <input
                          type="range"
                          min="24"
                          max="80"
                          value={templateForm.label_settings.kidLabel.roomSize}
                          onChange={(e) => updateLabelSetting('kidLabel', 'roomSize', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-slate-500 text-xs">{templateForm.label_settings.kidLabel.roomSize}px</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Accent Color</label>
                      <div className="flex gap-2">
                        {['#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444'].map(color => (
                          <button
                            key={color}
                            onClick={() => updateLabelSetting('kidLabel', 'accentColor', color)}
                            className={`w-8 h-8 rounded-full border-2 ${
                              templateForm.label_settings.kidLabel.accentColor === color 
                                ? 'border-white scale-110' 
                                : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <input
                          type="color"
                          value={templateForm.label_settings.kidLabel.accentColor}
                          onChange={(e) => updateLabelSetting('kidLabel', 'accentColor', e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Border Style</label>
                      <div className="flex gap-2">
                        {['pointed', 'rounded', 'none'].map(style => (
                          <button
                            key={style}
                            onClick={() => updateLabelSetting('kidLabel', 'borderStyle', style)}
                            className={`px-3 py-1 rounded text-sm ${
                              templateForm.label_settings.kidLabel.borderStyle === style
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {style.charAt(0).toUpperCase() + style.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Parent Label Settings */}
                {labelPreviewType === 'parent' && templateForm.label_settings?.parentLabel && (
                  <div className="space-y-4">
                    <h4 className="text-white font-semibold mb-3">Parent Receipt Label</h4>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={templateForm.label_settings.parentLabel.enabled}
                        onChange={(e) => updateLabelSetting('parentLabel', 'enabled', e.target.checked)}
                        className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                      />
                      <span className="text-white">Print parent receipts</span>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'showLogo', label: 'Show Logo' },
                        { key: 'showFamilyName', label: 'Show Family Name' },
                        { key: 'showChildren', label: 'Show Children' },
                        { key: 'showPickupCodes', label: 'Show Pickup Codes' },
                        { key: 'showRooms', label: 'Show Rooms' },
                        { key: 'showDate', label: 'Show Date' },
                        { key: 'showTime', label: 'Show Time' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={templateForm.label_settings.parentLabel[key]}
                            onChange={(e) => updateLabelSetting('parentLabel', key, e.target.checked)}
                            className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500"
                          />
                          <span className="text-slate-300">{label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-slate-400 text-sm mb-1">Title Size</label>
                        <input
                          type="range"
                          min="32"
                          max="72"
                          value={templateForm.label_settings.parentLabel.titleSize}
                          onChange={(e) => updateLabelSetting('parentLabel', 'titleSize', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-slate-500 text-xs">{templateForm.label_settings.parentLabel.titleSize}px</span>
                      </div>
                      <div>
                        <label className="block text-slate-400 text-sm mb-1">Name Size</label>
                        <input
                          type="range"
                          min="24"
                          max="60"
                          value={templateForm.label_settings.parentLabel.nameSize}
                          onChange={(e) => updateLabelSetting('parentLabel', 'nameSize', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-slate-500 text-xs">{templateForm.label_settings.parentLabel.nameSize}px</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Accent Color</label>
                      <div className="flex gap-2">
                        {['#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444'].map(color => (
                          <button
                            key={color}
                            onClick={() => updateLabelSetting('parentLabel', 'accentColor', color)}
                            className={`w-8 h-8 rounded-full border-2 ${
                              templateForm.label_settings.parentLabel.accentColor === color 
                                ? 'border-white scale-110' 
                                : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <input
                          type="color"
                          value={templateForm.label_settings.parentLabel.accentColor}
                          onChange={(e) => updateLabelSetting('parentLabel', 'accentColor', e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Volunteer Label Settings */}
                {labelPreviewType === 'volunteer' && templateForm.label_settings?.volunteerLabel && (
                  <div className="space-y-4">
                    <h4 className="text-white font-semibold mb-3">Volunteer Badge Label</h4>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={templateForm.label_settings.volunteerLabel.enabled}
                        onChange={(e) => updateLabelSetting('volunteerLabel', 'enabled', e.target.checked)}
                        className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-500"
                      />
                      <span className="text-white">Print volunteer badges</span>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'showInitials', label: 'Show Initials Box' },
                        { key: 'showName', label: 'Show Name' },
                        { key: 'showServiceArea', label: 'Show Service Area' },
                        { key: 'showDate', label: 'Show Date' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={templateForm.label_settings.volunteerLabel[key]}
                            onChange={(e) => updateLabelSetting('volunteerLabel', key, e.target.checked)}
                            className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-indigo-500"
                          />
                          <span className="text-slate-300">{label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="space-y-3 mt-4">
                      <div>
                        <label className="block text-slate-400 text-sm mb-1">Name Size</label>
                        <input
                          type="range"
                          min="80"
                          max="200"
                          value={templateForm.label_settings.volunteerLabel.nameSize}
                          onChange={(e) => updateLabelSetting('volunteerLabel', 'nameSize', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-slate-500 text-xs">{templateForm.label_settings.volunteerLabel.nameSize}px</span>
                      </div>
                      <div>
                        <label className="block text-slate-400 text-sm mb-1">Service Area Size</label>
                        <input
                          type="range"
                          min="32"
                          max="100"
                          value={templateForm.label_settings.volunteerLabel.serviceAreaSize}
                          onChange={(e) => updateLabelSetting('volunteerLabel', 'serviceAreaSize', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-slate-500 text-xs">{templateForm.label_settings.volunteerLabel.serviceAreaSize}px</span>
                      </div>
                      <div>
                        <label className="block text-slate-400 text-sm mb-1">Date Size</label>
                        <input
                          type="range"
                          min="24"
                          max="72"
                          value={templateForm.label_settings.volunteerLabel.dateSize}
                          onChange={(e) => updateLabelSetting('volunteerLabel', 'dateSize', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-slate-500 text-xs">{templateForm.label_settings.volunteerLabel.dateSize}px</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Accent Color</label>
                      <div className="flex gap-2">
                        {['#4F46E5', '#10B981', '#3B82F6', '#EC4899', '#F59E0B', '#EF4444'].map(color => (
                          <button
                            key={color}
                            onClick={() => updateLabelSetting('volunteerLabel', 'accentColor', color)}
                            className={`w-8 h-8 rounded-full border-2 ${
                              templateForm.label_settings.volunteerLabel.accentColor === color 
                                ? 'border-white scale-110' 
                                : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <input
                          type="color"
                          value={templateForm.label_settings.volunteerLabel.accentColor}
                          onChange={(e) => updateLabelSetting('volunteerLabel', 'accentColor', e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Preview */}
              <div className="w-1/2 p-4 bg-slate-900 flex flex-col">
                <h4 className="text-white font-semibold mb-3">Preview</h4>
                <div className="flex-1 flex items-center justify-center bg-white rounded-lg p-4 overflow-hidden">
                  {labelPreviewLoading ? (
                    <div className="text-slate-500">Generating preview...</div>
                  ) : labelPreviewUrl ? (
                    <img 
                      src={labelPreviewUrl} 
                      alt="Label Preview" 
                      className="max-w-full max-h-full object-contain shadow-lg"
                    />
                  ) : (
                    <div className="text-slate-500">Click a label type to preview</div>
                  )}
                </div>
                <p className="text-slate-500 text-xs mt-2 text-center">
                  Dymo 30256 Shipping Labels - 4" × 2.31"
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => { setShowLabelEditor(false); setLabelEditorTemplate(null); }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLabelSettings}
                disabled={templateSaving}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50"
              >
                {templateSaving ? 'Saving...' : 'Save Label Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h3>
            
            <div className="mb-4">
              <label className="block text-slate-300 mb-2">Template Name *</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="e.g., Sunday Morning, VBS, Childcare"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-slate-300 mb-2">Day of Week</label>
                <select
                  value={templateForm.day_of_week}
                  onChange={(e) => setTemplateForm({ ...templateForm, day_of_week: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Any day</option>
                  <option value="sunday">Sunday</option>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-slate-300 mb-2">Start Time</label>
                <input
                  type="time"
                  value={templateForm.start_time}
                  onChange={(e) => setTemplateForm({ ...templateForm, start_time: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">End Time</label>
                <input
                  type="time"
                  value={templateForm.end_time}
                  onChange={(e) => setTemplateForm({ ...templateForm, end_time: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateForm.checkout_enabled}
                  onChange={(e) => setTemplateForm({ ...templateForm, checkout_enabled: e.target.checked })}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                />
                <span className="text-white">Enable checkout (require pickup code)</span>
              </label>
              <p className="text-slate-400 text-sm mt-1 ml-8">
                When enabled, parents must enter pickup code to check out their children.
              </p>
            </div>

            {/* Streak Tracking Settings */}
            <div className="mb-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
              <label className="flex items-center gap-3 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={templateForm.track_streaks}
                  onChange={(e) => setTemplateForm({ ...templateForm, track_streaks: e.target.checked })}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                />
                <span className="text-white font-medium">🔥 Track attendance streaks</span>
              </label>
              <p className="text-slate-400 text-sm mb-3">
                Track consecutive attendance separately for this template/event.
              </p>
              
              {templateForm.track_streaks && (
                <div className="ml-8">
                  <label className="block text-slate-300 text-sm mb-2">
                    Reset streak after how many days?
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={templateForm.streak_reset_days}
                      onChange={(e) => setTemplateForm({ ...templateForm, streak_reset_days: parseInt(e.target.value) || 7 })}
                      className="w-20 bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-slate-300">days</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-2">
                    If a child doesn't check in within this many days, their streak resets to 1.
                    <br />
                    <span className="text-amber-400">Tip:</span> Use 7 for weekly events (Sunday service), 8-9 for some flexibility, 14 for bi-weekly events.
                  </p>
                </div>
              )}
            </div>

            {/* Volunteer Badge Printing Toggle */}
            <div className="mb-6 bg-slate-700/50 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateForm.print_volunteer_badges !== false}
                  onChange={(e) => setTemplateForm({ ...templateForm, print_volunteer_badges: e.target.checked })}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-800"
                />
                <span className="text-white font-medium">🏷️ Print volunteer badges</span>
              </label>
              <p className="text-slate-400 text-sm mt-2 ml-8">
                When enabled, volunteers will receive a printed name badge when they check in.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-slate-300 mb-2">Available Rooms</label>
              <div className="bg-slate-700 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                {rooms.length === 0 ? (
                  <p className="text-slate-400 text-sm">No rooms available. Create rooms first.</p>
                ) : (
                  rooms.map((room) => (
                    <label key={room.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-600 rounded">
                      <input
                        type="checkbox"
                        checked={templateForm.room_ids.includes(room.id)}
                        onChange={() => toggleRoomInTemplate(room.id)}
                        className="w-5 h-5 rounded bg-slate-600 border-slate-500 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-700"
                      />
                      <span className="text-white">{room.name}</span>
                      {room.age_range && (
                        <span className="text-slate-400 text-sm">Ages {room.age_range}</span>
                      )}
                    </label>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setTemplateForm({ ...templateForm, room_ids: rooms.map(r => r.id) })}
                  className="text-emerald-400 hover:text-emerald-300 text-sm"
                >
                  Select All
                </button>
                <span className="text-slate-500">|</span>
                <button
                  type="button"
                  onClick={() => setTemplateForm({ ...templateForm, room_ids: [] })}
                  className="text-slate-400 hover:text-slate-300 text-sm"
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setEditingTemplate(null);
                }}
                className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateForm.name.trim() || templateSaving}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {templateSaving ? 'Saving...' : (editingTemplate ? 'Save Changes' : 'Create Template')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Software Downloads */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">📥 Software Downloads</h3>
        <p className="text-slate-400 text-sm mb-4">
          Download the check-in kiosk software for local installation. Requires Dymo LabelWriter for printing.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-700 rounded-lg p-4 text-center">
            <div className="text-4xl mb-2">🍎</div>
            <h4 className="text-white font-medium mb-1">macOS (Apple Silicon)</h4>
            <p className="text-slate-400 text-xs mb-3">For M1/M2/M3 Macs</p>
            <a 
              href="/downloads/Adventure Kids Check-In-1.0.0-arm64.dmg"
              className="inline-block px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
            >
              Download DMG
            </a>
          </div>
          <div className="bg-slate-700 rounded-lg p-4 text-center">
            <div className="text-4xl mb-2">🍏</div>
            <h4 className="text-white font-medium mb-1">macOS (Intel)</h4>
            <p className="text-slate-400 text-xs mb-3">For older Intel Macs</p>
            <a 
              href="/downloads/Adventure Kids Check-In-1.0.0.dmg"
              className="inline-block px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
            >
              Download DMG
            </a>
          </div>
          <div className="bg-slate-700 rounded-lg p-4 text-center">
            <div className="text-4xl mb-2">🪟</div>
            <h4 className="text-white font-medium mb-1">Windows</h4>
            <p className="text-slate-400 text-xs mb-3">Windows 10/11 (64-bit)</p>
            <a 
              href="/downloads/Adventure Kids Check-In Setup 1.0.0.exe"
              className="inline-block px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
            >
              Download EXE
            </a>
          </div>
        </div>
        <p className="text-slate-500 text-xs mt-4 text-center">
          Version 1.0.0 • The software will sync with your database automatically.
        </p>
      </div>

      {/* Printer Settings */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Printer Settings</h3>
        <div className="mb-4">
          <label className="block text-slate-300 mb-2">Selected Printer</label>
          <select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500">
            <option>DYMO LabelWriter 450 Turbo</option>
            <option>DYMO LabelWriter 550</option>
            <option>Primera LX500 (Color)</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-slate-300 mb-2">Label Size</label>
          <select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500">
            <option>30256 - Shipping (2.3 x 4)</option>
            <option>30252 - Address (1.1 x 3.5)</option>
            <option>30324 - Diskette (2.1 x 2.8)</option>
          </select>
        </div>
        <button 
          onClick={handleTestPrint}
          disabled={testPrintStatus === 'printing'}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
        >
          {testPrintStatus === 'printing' ? 'Printing...' : 
           testPrintStatus === 'success' ? '✓ Printed!' :
           testPrintStatus === 'error' ? '✗ Failed' :
           'Print Test Label'}
        </button>
      </div>
    </div>
  );
}

// ============================================
// MAIN ADMIN COMPONENT
// ============================================

export default function Admin() {
  const [token, setToken] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    // Check for existing session
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
      verifyToken(savedToken);
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const verifyToken = async (savedToken) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/verify`, {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });
      
      if (response.ok) {
        setToken(savedToken);
      } else {
        localStorage.removeItem('adminToken');
      }
    } catch (err) {
      console.error('Error verifying token:', err);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      // Ignore errors
    }
    
    localStorage.removeItem('adminToken');
    setToken(null);
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!token) {
    return <LoginScreen onLogin={setToken} />;
  }

  // Show dashboard if authenticated
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        logo={logo} 
        onLogout={handleLogout}
      />
      
      <main className="flex-1 p-8">
        {activeTab === 'dashboard' && <DashboardTab token={token} />}
        {activeTab === 'families' && <FamiliesTab token={token} />}
        {activeTab === 'volunteers' && <VolunteersTab token={token} />}
        {activeTab === 'rewards' && <RewardsTab token={token} />}
        {activeTab === 'reports' && <ReportsTab token={token} />}
        {activeTab === 'settings' && <SettingsTab logo={logo} setLogo={setLogo} token={token} />}
      </main>
    </div>
  );
}
