/**
 * Roger RACS-5 Access Control System Integration Client
 * Direct SQL connection to VISO_Roger database on 192.168.3.5\SQLEXPRESS
 *
 * Bypasses the Integration Server SOAP API (requires paid VISO BASE license)
 * by querying the SQL Server database directly with a read-only user.
 *
 * Tables used:
 *   - AccessUserPersons  (persons/users)
 *   - AccessCredentials   (credentials/cards)
 *   - EventLogEntries     (access event log)
 *   - AccessDoors         (doors/access points)
 */

import { createClient } from '@supabase/supabase-js';
import sql from 'mssql';

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
  sqlServer: string;
  sqlPort: number;
  sqlDatabase: string;
  sqlUser: string;
  sqlPassword: string;
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
  AccessCredentialID: number | null;
  Description?: string;
}

export interface RacsPerson {
  ID: number;
  Name: string;
  FirstName: string;
  LastName: string;
  Email?: string;
  Deleted: boolean;
}

export interface RacsCredential {
  ID: number;
  AccessUserGlobalID: number;
  CredentialNumber: string;
  Deleted: boolean;
}

export interface RacsDoor {
  ID: number;
  Name: string;
  Deleted: boolean;
}

export class RacsClient {
  private config: RacsConfig;
  private pool: sql.ConnectionPool | null = null;

  constructor(config: RacsConfig) {
    this.config = config;
  }

  /**
   * Connect to VISO_Roger SQL Server database
   * Opens a connection pool for reuse across queries
   */
  async connect(): Promise<string> {
    try {
      const sqlConfig: sql.config = {
        user: this.config.sqlUser,
        password: this.config.sqlPassword,
        server: this.config.sqlServer,
        port: this.config.sqlPort,
        database: this.config.sqlDatabase,
        options: {
          encrypt: false, // Local network, no TLS
          trustServerCertificate: true,
          enableArithAbort: true,
          instanceName: 'SQLEXPRESS',
        },
        pool: {
          max: 5,
          min: 0,
          idleTimeoutMillis: 30000,
        },
        connectionTimeout: 15000,
        requestTimeout: 30000,
      };

      this.pool = await sql.connect(sqlConfig);
      console.log('[RACS] Connected to SQL Server:', this.config.sqlServer);
      return 'sql-connected';
    } catch (error) {
      console.error('[RACS] SQL connection error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from SQL Server
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('[RACS] Disconnected from SQL Server');
    }
  }

  /**
   * Ensure we have a valid connection pool
   */
  private async ensureConnection(): Promise<sql.ConnectionPool> {
    if (!this.pool || !this.pool.connected) {
      await this.connect();
    }
    return this.pool!;
  }

  /**
   * Take event entries starting from a specific ID
   * Replaces SOAP TakeEntriesStartingFrom
   */
  async takeEntriesStartingFrom(startId: number): Promise<RacsEventLogEntry[]> {
    try {
      const pool = await this.ensureConnection();
      const result = await pool.request()
        .input('startId', sql.Int, startId)
        .query(`
          SELECT TOP 1000
            ID, EventCode, LoggedOn, LoggedOnUtc,
            SourceType, SourceID,
            LocationType, LocationID,
            PersonID, AccessCredentialID,
            Details, Deleted
          FROM EventLogEntries
          WHERE ID > @startId AND (Deleted = 0 OR Deleted IS NULL)
          ORDER BY ID ASC
        `);

      return result.recordset.map((row: sql.IRecordSet<any>[number]) => ({
        ID: row.ID,
        EventCode: row.EventCode || 0,
        LoggedOn: row.LoggedOnUtc
          ? new Date(row.LoggedOnUtc).toISOString()
          : row.LoggedOn
            ? new Date(row.LoggedOn).toISOString()
            : '',
        SourceType: row.SourceType || 0,
        SourceID: row.SourceID || 0,
        LocationType: row.LocationType || 0,
        LocationID: row.LocationID || 0,
        PersonID: row.PersonID ?? null,
        AccessCredentialID: row.AccessCredentialID ?? null,
        Description: row.Details || undefined,
      }));
    } catch (error) {
      console.error('[RACS] Error taking event entries:', error);
      throw error;
    }
  }

  /**
   * Get last event ID from the log
   * Replaces SOAP GetLastEntryId
   */
  async getLastEntryId(): Promise<number> {
    try {
      const pool = await this.ensureConnection();
      const result = await pool.request()
        .query('SELECT MAX(ID) as LastId FROM EventLogEntries');

      return result.recordset[0]?.LastId || 0;
    } catch (error) {
      console.error('[RACS] Error getting last entry ID:', error);
      throw error;
    }
  }

  /**
   * Get all persons from RACS system
   * Replaces SOAP GetPersons
   */
  async getPersons(): Promise<RacsPerson[]> {
    try {
      const pool = await this.ensureConnection();
      const result = await pool.request()
        .query(`
          SELECT
            ID, GlobalID, Name, FirstName, LastName,
            Email, Deleted
          FROM AccessUserPersons
          WHERE IsTemplate = 0 OR IsTemplate IS NULL
        `);

      return result.recordset.map((row: sql.IRecordSet<any>[number]) => {
        const firstName = row.FirstName || '';
        const lastName = row.LastName || '';
        const name = row.Name || `${firstName} ${lastName}`.trim();

        return {
          ID: row.GlobalID || row.ID,
          Name: name,
          FirstName: firstName,
          LastName: lastName,
          Email: row.Email || undefined,
          Deleted: row.Deleted === true || row.Deleted === 1,
        };
      });
    } catch (error) {
      console.error('[RACS] Error getting persons:', error);
      throw error;
    }
  }

  /**
   * Get credentials from RACS system
   * Replaces SOAP GetCredentials
   * Uses AccessCredentials.Name as credential identifier
   */
  async getCredentials(): Promise<RacsCredential[]> {
    try {
      const pool = await this.ensureConnection();
      const result = await pool.request()
        .query(`
          SELECT
            ID, GlobalID, Name,
            AccessUserGlobalID,
            Deleted
          FROM AccessCredentials
          WHERE IsTemplate = 0 OR IsTemplate IS NULL
        `);

      return result.recordset.map((row: sql.IRecordSet<any>[number]) => ({
        ID: row.GlobalID || row.ID,
        AccessUserGlobalID: row.AccessUserGlobalID || 0,
        CredentialNumber: row.Name || '',
        Deleted: row.Deleted === true || row.Deleted === 1,
      }));
    } catch (error) {
      console.error('[RACS] Error getting credentials:', error);
      throw error;
    }
  }

  /**
   * Get doors from RACS system
   * Replaces SOAP GetDoors
   */
  async getDoors(): Promise<RacsDoor[]> {
    try {
      const pool = await this.ensureConnection();
      const result = await pool.request()
        .query(`
          SELECT
            ID, GlobalID, Name, Deleted
          FROM AccessDoors
          WHERE IsTemplate = 0 OR IsTemplate IS NULL
        `);

      return result.recordset.map((row: sql.IRecordSet<any>[number]) => ({
        ID: row.GlobalID || row.ID,
        Name: row.Name || '',
        Deleted: row.Deleted === true || row.Deleted === 1,
      }));
    } catch (error) {
      console.error('[RACS] Error getting doors:', error);
      throw error;
    }
  }
}

/**
 * Get RACS client instance from database config
 * Reads SQL connection details from racs_integration_config in Supabase
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
    console.warn('[RACS] No active RACS integration config found');
    return null;
  }

  return new RacsClient({
    sqlServer: config.service_url, // Now stores SQL Server host (192.168.3.5)
    sqlPort: 1434,
    sqlDatabase: 'VISO_Roger',
    sqlUser: config.username,
    sqlPassword: config.password_encrypted, // TODO: Implement proper decryption
  });
}
