/**
 * AdminApi - Scoped Supabase REST API Layer
 * 
 * Strict Constraints:
 * 1. MANDATORY PREFIX: Only allows tables starting with 'wosandi_'
 * 2. ZERO INTERFERENCE: Blocks all access to production tables (daily_logs, routine_tasks, etc.)
 * 3. DUAL COMPATIBILITY: Returns results that work both with destructuring { data, error }
 *    AND direct array/object usage (data.map, data[0], etc.).
 * 4. SCHEMA SANITIZATION: Strictly sanitizes payloads to match table schemas so PostgREST
 *    never rejects queries due to unexpected or null-violating columns.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AdminApi {
    constructor() {
        this.SUPABASE_URL = 'https://rxwopsfjnlzlzzazgnvq.supabase.co';
        this.SUPABASE_ANON_KEY = 'sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn';
        this.prefix = 'wosandi_';
    }

    _validateTable(name) {
        if (!name || typeof name !== 'string' || !name.startsWith(this.prefix)) {
            throw new Error(`Security Violation: Cannot access table '${name}'. All tables must strictly use '${this.prefix}' prefix.`);
        }
    }

    _getHeaders() {
        return {
            'apikey': this.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    // Wrap array to support both destructuring { data, error } and direct array methods
    _wrapArrayResult(arr, error = null) {
        const result = Array.isArray(arr) ? [...arr] : [];
        result.data = error ? null : result;
        result.error = error;
        return result;
    }

    // Wrap single object to support { data, error } and array indexing [0]
    _wrapObjectResult(obj, error = null) {
        const result = obj && typeof obj === 'object' ? { ...obj } : {};
        result.data = error ? null : result;
        result.error = error;
        result[0] = error ? undefined : result;
        return result;
    }

    /**
     * Sanitizes payloads before sending to Supabase PostgREST
     * Removes non-existent columns, strips non-UUID ids on insert,
     * and ensures JSONB fields adhere to NOT NULL constraints.
     */
    _sanitizePayload(table, data, isInsert = false) {
        const clean = { ...data };

        // Never send non-UUID ids (let PostgreSQL DEFAULT gen_random_uuid() generate it)
        if (isInsert) {
            if (!clean.id || !UUID_REGEX.test(clean.id)) {
                delete clean.id;
            }
        } else {
            // Cannot update primary key id
            delete clean.id;
        }

        // Remove timestamps from payload so DB triggers handle them
        delete clean.created_at;
        delete clean.updated_at;

        if (table === 'wosandi_tasks') {
            delete clean.title;
            delete clean.type;
            delete clean.points;
            if (clean.schema_definition === null || clean.schema_definition === undefined) {
                clean.schema_definition = {};
            }
        } else if (table === 'wosandi_timers') {
            delete clean.total_seconds;
            if (clean.trigger_config === null || clean.trigger_config === undefined) {
                clean.trigger_config = {};
            }
        } else if (table === 'wosandi_flows') {
            delete clean.title;
            delete clean.type;
            if (clean.flow_data === null || clean.flow_data === undefined) {
                clean.flow_data = { nodes: [], edges: [] };
            }
        } else if (table === 'wosandi_ui_schema') {
            delete clean.dynamic_config;
            if (clean.schema_definition === null || clean.schema_definition === undefined) {
                clean.schema_definition = {};
            }
        }

        return clean;
    }

    /**
     * Flexible, direct SELECT query from Supabase PostgREST
     * Supports:
     * - select(table)
     * - select(table, { status: 'published' }, 'sort_order', true)
     * - select(table, '*', filterString, orderBy, ascending)
     * - select(table, columns, filterQuery)
     */
    async select(table, arg2 = {}, arg3 = '', arg4 = 'created_at', arg5 = false) {
        this._validateTable(table);

        let filters = {};
        let selectCols = '*';
        let orderBy = 'created_at';
        let ascending = false;
        let rawFilterString = '';

        if (typeof arg2 === 'string') {
            selectCols = arg2 || '*';
            if (typeof arg3 === 'string') {
                rawFilterString = arg3;
            }
            if (typeof arg4 === 'string') {
                orderBy = arg4;
            }
            if (typeof arg5 === 'boolean') {
                ascending = arg5;
            }
        } else if (typeof arg2 === 'object' && arg2 !== null) {
            filters = arg2;
            if (typeof arg3 === 'string' && arg3) {
                orderBy = arg3;
            }
            if (typeof arg4 === 'boolean') {
                ascending = arg4;
            }
        }

        let url = `${this.SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(selectCols)}`;

        if (orderBy) {
            url += `&order=${orderBy}.${ascending ? 'asc' : 'desc'}`;
        }

        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null && value !== '') {
                url += `&${key}=eq.${encodeURIComponent(value)}`;
            }
        }

        if (rawFilterString) {
            url += `&${rawFilterString}`;
        }

        try {
            const response = await fetch(url, { headers: this._getHeaders() });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`Supabase SELECT on ${table} failed (${response.status}):`, errText);
                return this._wrapArrayResult([], `Database error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            return this._wrapArrayResult(data);
        } catch (e) {
            console.error(`Supabase network fetch failed for ${table}:`, e);
            return this._wrapArrayResult([], e.message);
        }
    }

    async selectById(table, id) {
        this._validateTable(table);
        const { data } = await this.select(table, { id });
        const item = data && data.length > 0 ? data[0] : null;
        return this._wrapObjectResult(item);
    }

    async insert(table, recordData) {
        this._validateTable(table);
        const cleanPayload = this._sanitizePayload(table, recordData, true);

        try {
            const response = await fetch(`${this.SUPABASE_URL}/rest/v1/${table}`, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify(cleanPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`Supabase INSERT on ${table} failed (${response.status}):`, errText);
                throw new Error(`Database error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            const saved = Array.isArray(data) && data.length > 0 ? data[0] : cleanPayload;
            return this._wrapObjectResult(saved);
        } catch (e) {
            console.error(`Error saving to ${table}:`, e);
            throw e;
        }
    }

    async update(table, id, updateData) {
        this._validateTable(table);
        const cleanPayload = this._sanitizePayload(table, updateData, false);

        try {
            const response = await fetch(`${this.SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers: this._getHeaders(),
                body: JSON.stringify(cleanPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`Supabase UPDATE on ${table} failed (${response.status}):`, errText);
                throw new Error(`Database error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            const updated = Array.isArray(data) && data.length > 0 ? data[0] : { id, ...cleanPayload };
            return this._wrapObjectResult(updated);
        } catch (e) {
            console.error(`Error updating ${table}:`, e);
            throw e;
        }
    }

    async upsert(table, data) {
        this._validateTable(table);
        if (data.id && UUID_REGEX.test(data.id)) {
            return this.update(table, data.id, data);
        }
        return this.insert(table, data);
    }

    async delete(table, id) {
        this._validateTable(table);

        try {
            const response = await fetch(`${this.SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: {
                    ...this._getHeaders(),
                    'Prefer': 'return=minimal'
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`Supabase DELETE on ${table} failed (${response.status}):`, errText);
                throw new Error(`Database error (${response.status}): ${errText}`);
            }

            return { data: true, error: null };
        } catch (e) {
            console.error(`Error deleting from ${table}:`, e);
            throw e;
        }
    }

    async getPublished(table) {
        return this.select(table, { status: 'published' });
    }

    async getDrafts(table) {
        return this.select(table, { status: 'draft' });
    }

    async publish(table, id) {
        return this.update(table, id, { status: 'published' });
    }

    async unpublish(table, id) {
        return this.update(table, id, { status: 'draft' });
    }

    /**
     * Cross-Module State Selector (Section 2.2):
     * Exposes active tasks from wosandi_tasks for embedding into Flow Builder nodes
     */
    async getActiveTasks() {
        try {
            const res = await this.select('wosandi_tasks', { status: 'published' });
            const published = res.data || (Array.isArray(res) ? res : []);
            if (published.length > 0) return published;

            // Fallback to all tasks if none published yet
            const allRes = await this.select('wosandi_tasks');
            return allRes.data || (Array.isArray(allRes) ? allRes : []);
        } catch (e) {
            console.warn('Error fetching active tasks from wosandi_tasks:', e);
            return [];
        }
    }
}

