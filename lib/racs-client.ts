/**
 * Roger RACS-5 Access Control System Integration Client
 * Based on RACS 5 Integration Manual v1.6
 */

import { createClient } from '@supabase/supabase-js';

// RACS Event Codes (from documentation)
export const RACS_EVENT_CODES = {
  DOOR_ACCESS_GRANTED: 601,
  DOOR_ACCESS_DENIED: 602,
  AUTHENTICATION_FACTOR_READ: 13,
  ANTI_PASSBACK_VIOLATION: 603,
  DOOR_FORCED_OPEN: 605,
  DOOR_LEFT_OPEN: 606,
} as const;

export interface RacsConfig {
  serviceUrl: string;
  username: string;
  password: string;
}

export interface RacsSession {
  sessionToken: string;
  expiresAt: Date;
}

export interface RacsEventLogEntry {
  ID: number;
  EventCode: number;
  LoggedOn: string; // ISO date string
  SourceType: number;
  SourceID: number;
  LocationType: number;
  LocationID: number;
  PersonID: number | null;
  CredentialID: number | null;
  Description?: string;
}

export interface RacsPerson {
  ID: number;
  FirstName: string;
  LastName: string;
  Email?: string;
  Active: boolean;
}

export interface RacsCredential {
  ID: number;
  PersonID: number;
  CredentialNumber: string;
  Active: boolean;
}

export interface RacsDoor {
  ID: number;
  Name: string;
  AccessPointID: number;
}

export class RacsClient {
  private config: RacsConfig;
  private session: RacsSession | null = null;

  constructor(config: RacsConfig) {
    this.config = config;
  }

  /**
   * Connect to RACS system and obtain session token
   */
  async connect(): Promise<string> {
    const url = `${this.config.serviceUrl}/SessionManagement`;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:sess="http://www.roger.pl/VISO/SessionManagement">
  <soap:Body>
    <sess:Connect>
      <sess:login>${this.escapeXml(this.config.username)}</sess:login>
      <sess:password>${this.escapeXml(this.config.password)}</sess:password>
    </sess:Connect>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.roger.pl/VISO/SessionManagement/ISessionManagement/Connect',
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        throw new Error(`RACS connection failed: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      const sessionToken = this.extractFromXml(xmlText, 'ConnectResult');

      if (!sessionToken) {
        throw new Error('Failed to extract session token from response');
      }

      // Session typically expires after 30 minutes
      this.session = {
        sessionToken,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };

      return sessionToken;
    } catch (error) {
      console.error('RACS connection error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from RACS system
   */
  async disconnect(): Promise<void> {
    if (!this.session) return;

    const url = `${this.config.serviceUrl}/SessionManagement`;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:sess="http://www.roger.pl/VISO/SessionManagement">
  <soap:Body>
    <sess:Disconnect>
      <sess:session>${this.session.sessionToken}</sess:session>
    </sess:Disconnect>
  </soap:Body>
</soap:Envelope>`;

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.roger.pl/VISO/SessionManagement/ISessionManagement/Disconnect',
        },
        body: soapEnvelope,
      });

      this.session = null;
    } catch (error) {
      console.error('RACS disconnect error:', error);
    }
  }

  /**
   * Ensure we have a valid session
   */
  private async ensureSession(): Promise<string> {
    if (this.session && this.session.expiresAt > new Date()) {
      return this.session.sessionToken;
    }
    return await this.connect();
  }

  /**
   * Get event log entries between two dates
   */
  async getEntriesBetweenDates(startDate: Date, endDate: Date): Promise<RacsEventLogEntry[]> {
    const sessionToken = await this.ensureSession();
    const url = `${this.config.serviceUrl}/EventLogManagement`;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:evl="http://www.roger.pl/VISO/EventLogManagement">
  <soap:Body>
    <evl:GetEntriesBetweenDates>
      <evl:session>${sessionToken}</evl:session>
      <evl:startDate>${startDate.toISOString()}</evl:startDate>
      <evl:endDate>${endDate.toISOString()}</evl:endDate>
    </evl:GetEntriesBetweenDates>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.roger.pl/VISO/EventLogManagement/IEventLogManagement/GetEntriesBetweenDates',
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        throw new Error(`Failed to get event entries: ${response.status}`);
      }

      const xmlText = await response.text();
      return this.parseEventLogEntries(xmlText);
    } catch (error) {
      console.error('Error getting event entries:', error);
      throw error;
    }
  }

  /**
   * Take event entries starting from a specific ID
   */
  async takeEntriesStartingFrom(startId: number, count: number = 100): Promise<RacsEventLogEntry[]> {
    const sessionToken = await this.ensureSession();
    const url = `${this.config.serviceUrl}/EventLogManagement`;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:evl="http://www.roger.pl/VISO/EventLogManagement">
  <soap:Body>
    <evl:TakeEntriesStartingFrom>
      <evl:session>${sessionToken}</evl:session>
      <evl:startId>${startId}</evl:startId>
      <evl:count>${count}</evl:count>
    </evl:TakeEntriesStartingFrom>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.roger.pl/VISO/EventLogManagement/IEventLogManagement/TakeEntriesStartingFrom',
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        throw new Error(`Failed to take event entries: ${response.status}`);
      }

      const xmlText = await response.text();
      return this.parseEventLogEntries(xmlText);
    } catch (error) {
      console.error('Error taking event entries:', error);
      throw error;
    }
  }

  /**
   * Get last event ID from the log
   */
  async getLastEntryId(): Promise<number> {
    const sessionToken = await this.ensureSession();
    const url = `${this.config.serviceUrl}/EventLogManagement`;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:evl="http://www.roger.pl/VISO/EventLogManagement">
  <soap:Body>
    <evl:GetLastEntryId>
      <evl:session>${sessionToken}</evl:session>
    </evl:GetLastEntryId>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.roger.pl/VISO/EventLogManagement/IEventLogManagement/GetLastEntryId',
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        throw new Error(`Failed to get last entry ID: ${response.status}`);
      }

      const xmlText = await response.text();
      const lastId = this.extractFromXml(xmlText, 'GetLastEntryIdResult');
      return parseInt(lastId || '0', 10);
    } catch (error) {
      console.error('Error getting last entry ID:', error);
      throw error;
    }
  }

  /**
   * Get all persons from RACS system
   */
  async getPersons(): Promise<RacsPerson[]> {
    const sessionToken = await this.ensureSession();
    const url = `${this.config.serviceUrl}/ConfigurationQuery`;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:cfg="http://www.roger.pl/VISO/ConfigurationQuery">
  <soap:Body>
    <cfg:GetPersons>
      <cfg:session>${sessionToken}</cfg:session>
    </cfg:GetPersons>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.roger.pl/VISO/ConfigurationQuery/IConfigurationQuery/GetPersons',
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        throw new Error(`Failed to get persons: ${response.status}`);
      }

      const xmlText = await response.text();
      return this.parsePersons(xmlText);
    } catch (error) {
      console.error('Error getting persons:', error);
      throw error;
    }
  }

  /**
   * Get credentials from RACS system
   */
  async getCredentials(): Promise<RacsCredential[]> {
    const sessionToken = await this.ensureSession();
    const url = `${this.config.serviceUrl}/ConfigurationQuery`;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:cfg="http://www.roger.pl/VISO/ConfigurationQuery">
  <soap:Body>
    <cfg:GetCredentials>
      <cfg:session>${sessionToken}</cfg:session>
    </cfg:GetCredentials>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.roger.pl/VISO/ConfigurationQuery/IConfigurationQuery/GetCredentials',
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        throw new Error(`Failed to get credentials: ${response.status}`);
      }

      const xmlText = await response.text();
      return this.parseCredentials(xmlText);
    } catch (error) {
      console.error('Error getting credentials:', error);
      throw error;
    }
  }

  /**
   * Get doors from RACS system
   */
  async getDoors(): Promise<RacsDoor[]> {
    const sessionToken = await this.ensureSession();
    const url = `${this.config.serviceUrl}/ConfigurationQuery`;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:cfg="http://www.roger.pl/VISO/ConfigurationQuery">
  <soap:Body>
    <cfg:GetDoors>
      <cfg:session>${sessionToken}</cfg:session>
    </cfg:GetDoors>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.roger.pl/VISO/ConfigurationQuery/IConfigurationQuery/GetDoors',
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        throw new Error(`Failed to get doors: ${response.status}`);
      }

      const xmlText = await response.text();
      return this.parseDoors(xmlText);
    } catch (error) {
      console.error('Error getting doors:', error);
      throw error;
    }
  }

  // Helper methods for XML parsing
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private extractFromXml(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  private parseEventLogEntries(xml: string): RacsEventLogEntry[] {
    const entries: RacsEventLogEntry[] = [];
    const entryRegex = /<EventLogEntryData>([\s\S]*?)<\/EventLogEntryData>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const entry: RacsEventLogEntry = {
        ID: parseInt(this.extractFromXml(entryXml, 'ID') || '0', 10),
        EventCode: parseInt(this.extractFromXml(entryXml, 'EventCode') || '0', 10),
        LoggedOn: this.extractFromXml(entryXml, 'LoggedOn') || '',
        SourceType: parseInt(this.extractFromXml(entryXml, 'SourceType') || '0', 10),
        SourceID: parseInt(this.extractFromXml(entryXml, 'SourceID') || '0', 10),
        LocationType: parseInt(this.extractFromXml(entryXml, 'LocationType') || '0', 10),
        LocationID: parseInt(this.extractFromXml(entryXml, 'LocationID') || '0', 10),
        PersonID: this.parseNullableInt(this.extractFromXml(entryXml, 'PersonID')),
        CredentialID: this.parseNullableInt(this.extractFromXml(entryXml, 'CredentialID')),
      };
      entries.push(entry);
    }

    return entries;
  }

  private parsePersons(xml: string): RacsPerson[] {
    const persons: RacsPerson[] = [];
    const personRegex = /<PersonData>([\s\S]*?)<\/PersonData>/g;
    let match;

    while ((match = personRegex.exec(xml)) !== null) {
      const personXml = match[1];
      persons.push({
        ID: parseInt(this.extractFromXml(personXml, 'ID') || '0', 10),
        FirstName: this.extractFromXml(personXml, 'FirstName') || '',
        LastName: this.extractFromXml(personXml, 'LastName') || '',
        Email: this.extractFromXml(personXml, 'Email') || undefined,
        Active: this.extractFromXml(personXml, 'Active') === 'true',
      });
    }

    return persons;
  }

  private parseCredentials(xml: string): RacsCredential[] {
    const credentials: RacsCredential[] = [];
    const credRegex = /<CredentialData>([\s\S]*?)<\/CredentialData>/g;
    let match;

    while ((match = credRegex.exec(xml)) !== null) {
      const credXml = match[1];
      credentials.push({
        ID: parseInt(this.extractFromXml(credXml, 'ID') || '0', 10),
        PersonID: parseInt(this.extractFromXml(credXml, 'PersonID') || '0', 10),
        CredentialNumber: this.extractFromXml(credXml, 'CredentialNumber') || '',
        Active: this.extractFromXml(credXml, 'Active') === 'true',
      });
    }

    return credentials;
  }

  private parseDoors(xml: string): RacsDoor[] {
    const doors: RacsDoor[] = [];
    const doorRegex = /<DoorData>([\s\S]*?)<\/DoorData>/g;
    let match;

    while ((match = doorRegex.exec(xml)) !== null) {
      const doorXml = match[1];
      doors.push({
        ID: parseInt(this.extractFromXml(doorXml, 'ID') || '0', 10),
        Name: this.extractFromXml(doorXml, 'Name') || '',
        AccessPointID: parseInt(this.extractFromXml(doorXml, 'AccessPointID') || '0', 10),
      });
    }

    return doors;
  }

  private parseNullableInt(value: string | null): number | null {
    if (!value || value === 'null' || value === '') return null;
    return parseInt(value, 10);
  }
}

/**
 * Get RACS client instance from database config
 */
export async function getRacsClient(): Promise<RacsClient | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: config } = await supabase
    .from('racs_integration_config')
    .select('*')
    .eq('sync_enabled', true)
    .single();

  if (!config) {
    console.warn('No active RACS integration config found');
    return null;
  }

  // In production, decrypt the password here
  const password = config.password_encrypted; // TODO: Implement decryption

  return new RacsClient({
    serviceUrl: config.service_url,
    username: config.username,
    password: password,
  });
}
