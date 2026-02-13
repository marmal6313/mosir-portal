/**
 * Mock Roger RACS-5 Server for Development
 * Simulates RACS SOAP/WCF API responses
 * Run: node scripts/mock-racs-server.js
 */

const http = require('http');
const PORT = 8892;

// Mock data
let sessionToken = 'mock-session-' + Date.now();
let eventIdCounter = 1000;

// Mock persons - PRAWDZIWI użytkownicy z bazy MOSIR
const mockPersons = [
  { ID: 1, FirstName: 'Cezary', LastName: 'Piechowicz', Email: 'c.piechowicz@mosir.ostrowmaz.pl', Active: true },
  { ID: 2, FirstName: 'Katarzyna', LastName: 'Heronimek', Email: 'k.heronimek@mosir.ostrowmaz.pl', Active: true },
  { ID: 3, FirstName: 'Katarzyna', LastName: 'Śniadała', Email: 'k.sniadala@mosir.ostrowmaz.pl', Active: true },
  { ID: 4, FirstName: 'Marcin', LastName: 'Maliszewski', Email: 'dyrektor@e-mosir.pl', Active: true },
  { ID: 5, FirstName: 'Ola', LastName: 'Bednarczyk', Email: 'a.bednarczyk@mosir.ostrowmaz.pl', Active: true },
  { ID: 6, FirstName: 'Robert', LastName: 'Grabowski', Email: 'r.grabowski@mosir.ostrowmaz.pl', Active: true },
  { ID: 7, FirstName: 'Monika', LastName: 'Napiórkowski', Email: 'm.napiorkowski@mosir.ostrowmaz.pl', Active: true },
  { ID: 8, FirstName: 'Małgorzata', LastName: 'Szumińska', Email: 'm.szuminska@mosir.ostrowmaz.pl', Active: true },
  { ID: 9, FirstName: 'Arkadiusz', LastName: 'Spinek', Email: 'a.spinek@mosir.ostrowmaz.pl', Active: true },
  { ID: 10, FirstName: 'Barbara', LastName: 'Siwek', Email: 'b.siwek@mosir.ostrowmaz.pl', Active: true },
  { ID: 11, FirstName: 'Anna', LastName: 'Kordek', Email: 'a.kordek@mosir.ostrowmaz.pl', Active: true },
  { ID: 12, FirstName: 'Waldemar', LastName: 'Konarzewski', Email: 'w.konarzewski@mosir.ostrowmaz.pl', Active: true },
  { ID: 13, FirstName: 'Oliwia', LastName: 'Pęzińska', Email: 'o.pezinska@mosir.ostrowmaz.pl', Active: true },
  { ID: 14, FirstName: 'Kacper', LastName: 'Piórkowski', Email: 'k.piorkowski@mosir.ostrowmaz.pl', Active: true },
  { ID: 15, FirstName: 'Agnieszka', LastName: 'Jaroszewska', Email: 'a.jaroszewska@mosir.ostrowmaz.pl', Active: true },
];

// Mock credentials (karty dostępu dla każdej osoby)
const mockCredentials = [
  { ID: 101, PersonID: 1, CredentialNumber: '10001234', Active: true },
  { ID: 102, PersonID: 2, CredentialNumber: '10002345', Active: true },
  { ID: 103, PersonID: 3, CredentialNumber: '10003456', Active: true },
  { ID: 104, PersonID: 4, CredentialNumber: '10004567', Active: true },
  { ID: 105, PersonID: 5, CredentialNumber: '10005678', Active: true },
  { ID: 106, PersonID: 6, CredentialNumber: '10006789', Active: true },
  { ID: 107, PersonID: 7, CredentialNumber: '10007890', Active: true },
  { ID: 108, PersonID: 8, CredentialNumber: '10008901', Active: true },
  { ID: 109, PersonID: 9, CredentialNumber: '10009012', Active: true },
  { ID: 110, PersonID: 10, CredentialNumber: '10010123', Active: true },
  { ID: 111, PersonID: 11, CredentialNumber: '10011234', Active: true },
  { ID: 112, PersonID: 12, CredentialNumber: '10012345', Active: true },
  { ID: 113, PersonID: 13, CredentialNumber: '10013456', Active: true },
  { ID: 114, PersonID: 14, CredentialNumber: '10014567', Active: true },
  { ID: 115, PersonID: 15, CredentialNumber: '10015678', Active: true },
];

// Mock doors
const mockDoors = [
  { ID: 1, Name: 'Wejście główne', AccessPointID: 1 },
  { ID: 2, Name: 'Wejście boczne', AccessPointID: 2 },
  { ID: 3, Name: 'Wejście biuro', AccessPointID: 1 },
];

// Mock events - generujemy losowe zdarzenia z ostatnich 30 dni
const mockEvents = [];
function generateMockEvents() {
  const now = new Date();
  const daysBack = 30;

  for (let day = 0; day < daysBack; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);

    // Dla każdej osoby generuj 2-4 zdarzenia dziennie (wejście/wyjście)
    mockPersons.forEach(person => {
      const credential = mockCredentials.find(c => c.PersonID === person.ID);
      if (!credential) return;

      // Pomijaj weekendy czasami
      if (date.getDay() === 0 || date.getDay() === 6) {
        if (Math.random() > 0.3) return; // 70% szans na pominięcie weekendu
      }

      // Wejście rano (7:30 - 9:00)
      const entryHour = 7 + Math.random() * 1.5;
      const entryMinute = Math.floor(Math.random() * 60);
      const entryTime = new Date(date);
      entryTime.setHours(Math.floor(entryHour), entryMinute, 0);

      mockEvents.push({
        ID: eventIdCounter++,
        EventCode: 601, // Door Access Granted
        LoggedOn: entryTime.toISOString(),
        SourceType: 1,
        SourceID: 1,
        LocationType: 2,
        LocationID: Math.floor(Math.random() * 3) + 1, // Random door
        PersonID: person.ID,
        CredentialID: credential.ID,
      });

      // Wyjście wieczorem (15:30 - 17:00)
      const exitHour = 15.5 + Math.random() * 1.5;
      const exitMinute = Math.floor(Math.random() * 60);
      const exitTime = new Date(date);
      exitTime.setHours(Math.floor(exitHour), exitMinute, 0);

      mockEvents.push({
        ID: eventIdCounter++,
        EventCode: 601, // Door Access Granted
        LoggedOn: exitTime.toISOString(),
        SourceType: 1,
        SourceID: 1,
        LocationType: 2,
        LocationID: Math.floor(Math.random() * 3) + 1,
        PersonID: person.ID,
        CredentialID: credential.ID,
      });

      // Czasami dodaj losowe zdarzenie w ciągu dnia
      if (Math.random() > 0.7) {
        const midDayHour = 11 + Math.random() * 3;
        const midDayMinute = Math.floor(Math.random() * 60);
        const midDayTime = new Date(date);
        midDayTime.setHours(Math.floor(midDayHour), midDayMinute, 0);

        mockEvents.push({
          ID: eventIdCounter++,
          EventCode: 601,
          LoggedOn: midDayTime.toISOString(),
          SourceType: 1,
          SourceID: 1,
          LocationType: 2,
          LocationID: Math.floor(Math.random() * 3) + 1,
          PersonID: person.ID,
          CredentialID: credential.ID,
        });
      }
    });
  }

  // Sortuj po ID
  mockEvents.sort((a, b) => a.ID - b.ID);
}

generateMockEvents();
console.log(`Generated ${mockEvents.length} mock events`);

// SOAP Response builders
function buildSoapEnvelope(body) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;
}

function buildConnectResponse() {
  return buildSoapEnvelope(`
    <ConnectResponse xmlns="http://www.roger.pl/VISO/SessionManagement">
      <ConnectResult>${sessionToken}</ConnectResult>
    </ConnectResponse>
  `);
}

function buildDisconnectResponse() {
  return buildSoapEnvelope(`
    <DisconnectResponse xmlns="http://www.roger.pl/VISO/SessionManagement">
      <DisconnectResult>true</DisconnectResult>
    </DisconnectResponse>
  `);
}

function buildGetLastEntryIdResponse() {
  const lastId = mockEvents.length > 0 ? mockEvents[mockEvents.length - 1].ID : 0;
  return buildSoapEnvelope(`
    <GetLastEntryIdResponse xmlns="http://www.roger.pl/VISO/EventLogManagement">
      <GetLastEntryIdResult>${lastId}</GetLastEntryIdResult>
    </GetLastEntryIdResponse>
  `);
}

function buildEventLogEntriesResponse(events) {
  const entriesXml = events.map(event => `
    <EventLogEntryData>
      <ID>${event.ID}</ID>
      <EventCode>${event.EventCode}</EventCode>
      <LoggedOn>${event.LoggedOn}</LoggedOn>
      <SourceType>${event.SourceType}</SourceType>
      <SourceID>${event.SourceID}</SourceID>
      <LocationType>${event.LocationType}</LocationType>
      <LocationID>${event.LocationID}</LocationID>
      <PersonID>${event.PersonID}</PersonID>
      <CredentialID>${event.CredentialID}</CredentialID>
    </EventLogEntryData>
  `).join('');

  return buildSoapEnvelope(`
    <TakeEntriesStartingFromResponse xmlns="http://www.roger.pl/VISO/EventLogManagement">
      <TakeEntriesStartingFromResult>
        ${entriesXml}
      </TakeEntriesStartingFromResult>
    </TakeEntriesStartingFromResponse>
  `);
}

function buildGetPersonsResponse() {
  const personsXml = mockPersons.map(person => `
    <PersonData>
      <ID>${person.ID}</ID>
      <FirstName>${person.FirstName}</FirstName>
      <LastName>${person.LastName}</LastName>
      <Email>${person.Email}</Email>
      <Active>${person.Active}</Active>
    </PersonData>
  `).join('');

  return buildSoapEnvelope(`
    <GetPersonsResponse xmlns="http://www.roger.pl/VISO/ConfigurationQuery">
      <GetPersonsResult>
        ${personsXml}
      </GetPersonsResult>
    </GetPersonsResponse>
  `);
}

function buildGetCredentialsResponse() {
  const credentialsXml = mockCredentials.map(cred => `
    <CredentialData>
      <ID>${cred.ID}</ID>
      <PersonID>${cred.PersonID}</PersonID>
      <CredentialNumber>${cred.CredentialNumber}</CredentialNumber>
      <Active>${cred.Active}</Active>
    </CredentialData>
  `).join('');

  return buildSoapEnvelope(`
    <GetCredentialsResponse xmlns="http://www.roger.pl/VISO/ConfigurationQuery">
      <GetCredentialsResult>
        ${credentialsXml}
      </GetCredentialsResult>
    </GetCredentialsResponse>
  `);
}

function buildGetDoorsResponse() {
  const doorsXml = mockDoors.map(door => `
    <DoorData>
      <ID>${door.ID}</ID>
      <Name>${door.Name}</Name>
      <AccessPointID>${door.AccessPointID}</AccessPointID>
    </DoorData>
  `).join('');

  return buildSoapEnvelope(`
    <GetDoorsResponse xmlns="http://www.roger.pl/VISO/ConfigurationQuery">
      <GetDoorsResult>
        ${doorsXml}
      </GetDoorsResult>
    </GetDoorsResponse>
  `);
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, SOAPAction');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Read request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');

    try {
      // Session Management
      if (req.url === '/SessionManagement') {
        if (body.includes('Connect')) {
          console.log('  → Connect request');
          res.writeHead(200);
          res.end(buildConnectResponse());
        } else if (body.includes('Disconnect')) {
          console.log('  → Disconnect request');
          res.writeHead(200);
          res.end(buildDisconnectResponse());
        } else {
          res.writeHead(400);
          res.end('Unknown SessionManagement operation');
        }
      }
      // Event Log Management
      else if (req.url === '/EventLogManagement') {
        if (body.includes('GetLastEntryId')) {
          console.log('  → GetLastEntryId request');
          res.writeHead(200);
          res.end(buildGetLastEntryIdResponse());
        } else if (body.includes('TakeEntriesStartingFrom')) {
          console.log('  → TakeEntriesStartingFrom request');

          // Parse startId from request
          const startIdMatch = body.match(/<.*:startId>(\d+)<\/.*:startId>/);
          const startId = startIdMatch ? parseInt(startIdMatch[1]) : 0;

          // Parse count from request
          const countMatch = body.match(/<.*:count>(\d+)<\/.*:count>/);
          const count = countMatch ? parseInt(countMatch[1]) : 100;

          console.log(`  → Fetching events from ID ${startId}, limit ${count}`);

          // Filter and return events
          const filteredEvents = mockEvents.filter(e => e.ID > startId).slice(0, count);
          console.log(`  → Returning ${filteredEvents.length} events`);

          res.writeHead(200);
          res.end(buildEventLogEntriesResponse(filteredEvents));
        } else if (body.includes('GetEntriesBetweenDates')) {
          console.log('  → GetEntriesBetweenDates request');

          // For simplicity, return recent events
          const recentEvents = mockEvents.slice(-100);

          res.writeHead(200);
          res.end(buildEventLogEntriesResponse(recentEvents));
        } else {
          res.writeHead(400);
          res.end('Unknown EventLogManagement operation');
        }
      }
      // Configuration Query
      else if (req.url === '/ConfigurationQuery') {
        if (body.includes('GetPersons')) {
          console.log('  → GetPersons request');
          res.writeHead(200);
          res.end(buildGetPersonsResponse());
        } else if (body.includes('GetCredentials')) {
          console.log('  → GetCredentials request');
          res.writeHead(200);
          res.end(buildGetCredentialsResponse());
        } else if (body.includes('GetDoors')) {
          console.log('  → GetDoors request');
          res.writeHead(200);
          res.end(buildGetDoorsResponse());
        } else {
          res.writeHead(400);
          res.end('Unknown ConfigurationQuery operation');
        }
      }
      // Health check
      else if (req.url === '/health' || req.url === '/') {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'ok',
          service: 'Mock RACS Server',
          events: mockEvents.length,
          persons: mockPersons.length,
          credentials: mockCredentials.length,
        }));
      }
      else {
        res.writeHead(404);
        res.end('Not found');
      }
    } catch (error) {
      console.error('Error:', error);
      res.writeHead(500);
      res.end('Internal server error');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Mock RACS Server started!`);
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`📊 Mock data:`);
  console.log(`   - ${mockPersons.length} persons`);
  console.log(`   - ${mockCredentials.length} credentials`);
  console.log(`   - ${mockEvents.length} events (last 30 days)`);
  console.log(`   - ${mockDoors.length} doors`);
  console.log(`\n✅ Ready to accept connections!`);
  console.log(`\n💡 Update your RACS config to: http://localhost:${PORT}\n`);
});
