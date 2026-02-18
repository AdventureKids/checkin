// ============================================
// DYMO BROWSER PRINTING UTILITY
// ============================================
// This module handles printing to Dymo LabelWriter printers
// via the Dymo Connect service running locally on the user's computer.
//
// Requirements:
// 1. Dymo Connect software installed and running
// 2. Dymo LabelWriter printer connected via USB
// 3. Browser with JavaScript enabled

const DYMO_SERVICE_URL = 'https://127.0.0.1:41951/DYMO/DLS/Printing';
const DYMO_SERVICE_URL_HTTP = 'http://127.0.0.1:41951/DYMO/DLS/Printing';

// Check if Dymo Connect service is running
export async function isDymoServiceRunning() {
  try {
    // Try HTTPS first (newer Dymo Connect versions)
    const response = await fetch(`${DYMO_SERVICE_URL}/StatusConnected`, {
      method: 'GET',
      mode: 'cors',
    });
    if (response.ok) return { running: true, url: DYMO_SERVICE_URL };
  } catch (e) {
    // HTTPS failed, try HTTP
    try {
      const response = await fetch(`${DYMO_SERVICE_URL_HTTP}/StatusConnected`, {
        method: 'GET',
        mode: 'cors',
      });
      if (response.ok) return { running: true, url: DYMO_SERVICE_URL_HTTP };
    } catch (e2) {
      // Both failed
    }
  }
  return { running: false, url: null };
}

// Get list of available Dymo printers
export async function getDymoPrinters() {
  const { running, url } = await isDymoServiceRunning();
  if (!running) {
    throw new Error('Dymo Connect service is not running. Please start Dymo Connect software.');
  }

  try {
    const response = await fetch(`${url}/GetPrinters`, {
      method: 'GET',
      mode: 'cors',
    });
    
    if (!response.ok) {
      throw new Error('Failed to get printers');
    }
    
    const xmlText = await response.text();
    // Parse the XML response to get printer names
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const printers = [];
    
    const printerNodes = xmlDoc.getElementsByTagName('LabelWriterPrinter');
    for (let i = 0; i < printerNodes.length; i++) {
      const nameNode = printerNodes[i].getElementsByTagName('Name')[0];
      if (nameNode) {
        printers.push({
          name: nameNode.textContent,
          type: 'LabelWriter'
        });
      }
    }
    
    return printers;
  } catch (err) {
    console.error('Error getting Dymo printers:', err);
    throw err;
  }
}

// Generate label XML for a child check-in label
export function generateChildLabelXml(data) {
  const {
    childName = 'Child Name',
    pickupCode = '0000',
    room = 'Room',
    parentName = 'Parent',
    parentPhone = '',
    allergies = '',
    date = new Date().toLocaleDateString(),
    time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } = data;

  // Dymo Label XML format for a 2.25" x 1.25" label (30252 Address Labels work well)
  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Address</Id>
  <PaperName>30252 Address</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="3060" Height="1800" Rx="150" Ry="150"/>
  </DrawCommands>
  <ObjectInfo>
    <TextObject>
      <Name>ChildName</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${escapeXml(childName)}</String>
          <Attributes>
            <Font Family="Arial" Size="18" Bold="True" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="100" Y="50" Width="2860" Height="450"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>PickupCode</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>PICKUP: ${escapeXml(pickupCode)}</String>
          <Attributes>
            <Font Family="Arial" Size="24" Bold="True" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="100" Y="500" Width="2860" Height="500"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>Details</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${escapeXml(room)} | ${escapeXml(date)} ${escapeXml(time)}</String>
          <Attributes>
            <Font Family="Arial" Size="10" Bold="False" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="80" Green="80" Blue="80"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="100" Y="1000" Width="2860" Height="250"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>Parent</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${escapeXml(parentName)}${parentPhone ? ' | ' + escapeXml(parentPhone) : ''}</String>
          <Attributes>
            <Font Family="Arial" Size="9" Bold="False" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="100" Green="100" Blue="100"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="100" Y="1250" Width="2860" Height="200"/>
  </ObjectInfo>
  ${allergies ? `
  <ObjectInfo>
    <TextObject>
      <Name>Allergies</Name>
      <ForeColor Alpha="255" Red="200" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>⚠️ ${escapeXml(allergies)}</String>
          <Attributes>
            <Font Family="Arial" Size="8" Bold="True" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="200" Green="0" Blue="0"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="100" Y="1450" Width="2860" Height="200"/>
  </ObjectInfo>
  ` : ''}
</DieCutLabel>`;
}

// Generate parent pickup label XML
export function generateParentLabelXml(data) {
  const {
    childName = 'Child Name',
    pickupCode = '0000',
    room = 'Room',
    date = new Date().toLocaleDateString()
  } = data;

  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Address</Id>
  <PaperName>30252 Address</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="3060" Height="1800" Rx="150" Ry="150"/>
  </DrawCommands>
  <ObjectInfo>
    <TextObject>
      <Name>Title</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>PARENT PICKUP</String>
          <Attributes>
            <Font Family="Arial" Size="12" Bold="True" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="100" Y="50" Width="2860" Height="300"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>PickupCode</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${escapeXml(pickupCode)}</String>
          <Attributes>
            <Font Family="Arial" Size="36" Bold="True" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="100" Y="400" Width="2860" Height="700"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>Details</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${escapeXml(childName)} | ${escapeXml(room)}</String>
          <Attributes>
            <Font Family="Arial" Size="10" Bold="False" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="80" Green="80" Blue="80"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="100" Y="1150" Width="2860" Height="250"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>Date</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${escapeXml(date)}</String>
          <Attributes>
            <Font Family="Arial" Size="9" Bold="False" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="120" Green="120" Blue="120"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="100" Y="1400" Width="2860" Height="200"/>
  </ObjectInfo>
</DieCutLabel>`;
}

// Escape special XML characters
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Print a label using Dymo Connect
export async function printLabel(printerName, labelXml) {
  const { running, url } = await isDymoServiceRunning();
  if (!running) {
    throw new Error('Dymo Connect service is not running. Please start Dymo Connect software.');
  }

  // Dymo Connect requires printParamsXml parameter
  const printParamsXml = '<LabelWriterPrintParams><Copies>1</Copies><PrintQuality>BarcodeAndGraphics</PrintQuality><TwinTurboRoll>Auto</TwinTurboRoll></LabelWriterPrintParams>';

  const body = new URLSearchParams();
  body.append('printerName', printerName);
  body.append('printParamsXml', printParamsXml);
  body.append('labelXml', labelXml);
  body.append('labelSetXml', '');

  try {
    const response = await fetch(`${url}/PrintLabel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      mode: 'cors',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Print failed: ${errorText}`);
    }

    return { success: true };
  } catch (err) {
    console.error('Dymo print error:', err);
    throw err;
  }
}

// High-level function to print a child check-in label
export async function printChildLabel(printerName, childData) {
  const labelXml = generateChildLabelXml(childData);
  return printLabel(printerName, labelXml);
}

// High-level function to print a parent pickup label
export async function printParentLabel(printerName, childData) {
  const labelXml = generateParentLabelXml(childData);
  return printLabel(printerName, labelXml);
}

// Print both child and parent labels
export async function printCheckInLabels(printerName, childData) {
  await printChildLabel(printerName, childData);
  await printParentLabel(printerName, childData);
  return { success: true, printed: 2 };
}

// ============================================
// LOCAL PRINT HELPER (fallback - bypasses DYMO Connect)
// ============================================
const PRINT_HELPER_URL = 'http://localhost:3100';

export async function isPrintHelperRunning() {
  try {
    const response = await fetch(`${PRINT_HELPER_URL}/status`, { mode: 'cors' });
    if (response.ok) {
      const data = await response.json();
      return { running: true, printer: data.printer };
    }
  } catch (e) {}
  return { running: false };
}

export async function printViaHelper(labelData) {
  const response = await fetch(`${PRINT_HELPER_URL}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(labelData),
    mode: 'cors',
  });
  return response.json();
}

export default {
  isDymoServiceRunning,
  getDymoPrinters,
  printLabel,
  printChildLabel,
  printParentLabel,
  printCheckInLabels,
  generateChildLabelXml,
  generateParentLabelXml,
  isPrintHelperRunning,
  printViaHelper
};




