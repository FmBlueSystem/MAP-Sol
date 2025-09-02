"""
Advanced search parser and engine for music library queries.
"""

import re
import sqlite3
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime


class AdvancedSearchParser:
    """Parse advanced search queries into structured format."""
    
    # Field mappings for AI fields
    FIELD_MAPPINGS = {
        'mood': 'a.mood',
        'ai_mood': 'a.mood',
        'ai_genre': 'a.genre',
        # Direct track fields
        'title': 't.title',
        'artist': 't.artist', 
        'album': 't.album',
        'genre': 't.genre',
        'bpm': 't.bpm',
        'initial_key': 't.initial_key',
        'camelot_key': 't.camelot_key',
        'energy_level': 't.energy_level',
        'duration': 't.duration',
        'year': 't.year'
    }
    
    def parse_query(self, query_string: str) -> Dict:
        """
        Parse query string into structured format.
        
        Args:
            query_string: Query like "bpm BETWEEN 120 AND 128 AND mood = 'driving'"
            
        Returns:
            Structured query dict with conditions and operators
        """
        # Normalize query
        query = query_string.strip()
        
        # Parse into tokens and build condition tree
        conditions = self._parse_conditions(query)
        
        return {
            'conditions': conditions,
            'original': query_string
        }
    
    def _parse_conditions(self, query: str) -> List[Dict]:
        """Parse conditions from query string."""
        conditions = []
        
        # Split by AND/OR while respecting parentheses
        # Simple approach: split by top-level AND/OR
        parts = self._split_by_logical_operators(query)
        
        for part in parts:
            if 'operator' in part:
                conditions.append(part)
            else:
                # Parse individual condition
                condition = self._parse_single_condition(part['text'])
                if condition:
                    conditions.append(condition)
        
        return conditions
    
    def _split_by_logical_operators(self, query: str) -> List[Dict]:
        """Split query by AND/OR operators while respecting parentheses."""
        parts = []
        current = []
        paren_depth = 0
        
        # Handle parentheses groups specially
        if '(' in query:
            # Find parenthesized expressions
            result = []
            temp = ""
            paren_count = 0
            i = 0
            
            while i < len(query):
                char = query[i]
                if char == '(':
                    if paren_count == 0 and temp.strip():
                        # Process what came before the parenthesis
                        for part in self._split_simple_conditions(temp):
                            result.append(part)
                        temp = ""
                    paren_count += 1
                    temp += char
                elif char == ')':
                    paren_count -= 1
                    temp += char
                    if paren_count == 0:
                        # Complete parenthesized group
                        result.append({'text': temp})
                        temp = ""
                else:
                    temp += char
                i += 1
            
            if temp.strip():
                for part in self._split_simple_conditions(temp):
                    result.append(part)
            
            return result
        else:
            return self._split_simple_conditions(query)
    
    def _split_simple_conditions(self, query: str) -> List[Dict]:
        """Split simple conditions by AND/OR without parentheses."""
        parts = []
        
        # Split by AND/OR
        tokens = re.split(r'\s+(AND|OR)\s+', query, flags=re.IGNORECASE)
        
        for i, token in enumerate(tokens):
            if not token.strip():
                continue
            
            if token.upper() in ('AND', 'OR'):
                parts.append({'operator': token.upper()})
            else:
                parts.append({'text': token})
        
        return parts
    
    def _parse_single_condition(self, condition_str: str) -> Optional[Dict]:
        """Parse a single condition."""
        condition_str = condition_str.strip()
        
        # Remove outer parentheses if present
        if condition_str.startswith('(') and condition_str.endswith(')'):
            condition_str = condition_str[1:-1].strip()
        
        # Check for IN operator
        in_match = re.match(r'(\w+)\s+IN\s+\{([^}]+)\}', condition_str, re.IGNORECASE)
        if in_match:
            field = in_match.group(1).lower()
            values_str = in_match.group(2)
            values = [v.strip().strip('"\'') for v in values_str.split(',')]
            return {
                'type': 'in',
                'field': field,
                'values': values
            }
        
        # Check for BETWEEN operator
        between_match = re.match(r'(\w+)\s+BETWEEN\s+(\S+)\s+AND\s+(\S+)', condition_str, re.IGNORECASE)
        if between_match:
            field = between_match.group(1).lower()
            min_val = between_match.group(2)
            max_val = between_match.group(3)
            return {
                'type': 'between',
                'field': field,
                'min': self._parse_value(min_val),
                'max': self._parse_value(max_val)
            }
        
        # Check for comparison operators
        comp_match = re.match(r'(\w+)\s*(=|!=|>=|<=|>|<|LIKE)\s*(.+)', condition_str, re.IGNORECASE)
        if comp_match:
            field = comp_match.group(1).lower()
            operator = comp_match.group(2).upper()
            value = comp_match.group(3).strip().strip('"\'')
            return {
                'type': 'comparison',
                'field': field,
                'operator': operator,
                'value': self._parse_value(value)
            }
        
        return None
    
    def _parse_value(self, value_str: str) -> Any:
        """Parse value string to appropriate type."""
        value_str = value_str.strip().strip('"\'')
        
        # Try to parse as number
        try:
            if '.' in value_str:
                return float(value_str)
            return int(value_str)
        except ValueError:
            return value_str


class AdvancedSearchEngine:
    """Execute advanced searches on music database."""
    
    def __init__(self, db):
        """Initialize with database connection."""
        self.db = db
        self.parser = AdvancedSearchParser()
        self._ensure_saved_searches_table()
    
    def _ensure_saved_searches_table(self):
        """Create saved_searches table if it doesn't exist."""
        try:
            self.db.conn.execute('''
                CREATE TABLE IF NOT EXISTS saved_searches (
                    name TEXT PRIMARY KEY,
                    query TEXT NOT NULL,
                    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            self.db.conn.commit()
        except sqlite3.Error as e:
            print(f"Error creating saved_searches table: {e}")
    
    def search(self, query_string: str) -> List[Dict]:
        """
        Execute search query and return results.
        
        Args:
            query_string: Advanced search query
            
        Returns:
            List of track dicts matching the query
        """
        # Parse query
        parsed = self.parser.parse_query(query_string)
        
        # Build SQL query
        sql, params = self._build_sql_query(parsed)
        
        # Execute query
        try:
            cursor = self.db.conn.execute(sql, params)
            results = []
            
            for row in cursor.fetchall():
                track = dict(zip([col[0] for col in cursor.description], row))
                results.append(track)
            
            return results
            
        except sqlite3.Error as e:
            raise ValueError(f"Search query error: {e}")
    
    def _build_sql_query(self, parsed: Dict) -> Tuple[str, List]:
        """Build SQL query from parsed structure."""
        base_sql = '''
            SELECT t.*, a.mood, a.genre as ai_genre
            FROM tracks t
            LEFT JOIN ai_analysis a ON a.track_id = t.id
        '''
        
        where_clause, params = self._build_where_clause(parsed['conditions'])
        
        if where_clause:
            sql = f"{base_sql} WHERE {where_clause}"
        else:
            sql = base_sql
        
        return sql, params
    
    def _build_where_clause(self, conditions: List[Dict]) -> Tuple[str, List]:
        """Build WHERE clause from conditions."""
        if not conditions:
            return "", []
        
        clauses = []
        params = []
        
        for condition in conditions:
            if 'operator' in condition:
                # Logical operator - only add if we have preceding clauses
                if clauses and clauses[-1] not in ('AND', 'OR'):
                    clauses.append(condition['operator'])
            else:
                # Build condition clause
                clause, cond_params = self._build_condition_clause(condition)
                if clause:
                    clauses.append(clause)
                    params.extend(cond_params)
        
        # Remove trailing operators if any
        while clauses and clauses[-1] in ('AND', 'OR'):
            clauses.pop()
        
        # Join clauses
        where_str = ' '.join(clauses)
        
        return where_str, params
    
    def _build_condition_clause(self, condition: Dict) -> Tuple[str, List]:
        """Build SQL clause for a single condition."""
        field = condition.get('field')
        
        # Map field to table column
        if field in self.parser.FIELD_MAPPINGS:
            column = self.parser.FIELD_MAPPINGS[field]
        else:
            column = f't.{field}'
        
        params = []
        
        if condition['type'] == 'in':
            placeholders = ','.join(['?' for _ in condition['values']])
            clause = f"{column} IN ({placeholders})"
            params = condition['values']
            
        elif condition['type'] == 'between':
            clause = f"{column} BETWEEN ? AND ?"
            params = [condition['min'], condition['max']]
            
        elif condition['type'] == 'comparison':
            operator = condition['operator']
            if operator == '=':
                operator = '='
            clause = f"{column} {operator} ?"
            params = [condition['value']]
        else:
            return "", []
        
        return f"({clause})", params
    
    def save_search(self, name: str, query_string: str) -> None:
        """Save a search query with a name."""
        try:
            self.db.conn.execute('''
                INSERT OR REPLACE INTO saved_searches (name, query)
                VALUES (?, ?)
            ''', (name, query_string))
            self.db.conn.commit()
        except sqlite3.Error as e:
            raise ValueError(f"Error saving search: {e}")
    
    def list_saved(self) -> List[Dict]:
        """List all saved searches."""
        try:
            cursor = self.db.conn.execute('''
                SELECT name, query, created
                FROM saved_searches
                ORDER BY created DESC
            ''')
            
            results = []
            for row in cursor.fetchall():
                results.append({
                    'name': row[0],
                    'query': row[1],
                    'created': row[2]
                })
            
            return results
            
        except sqlite3.Error as e:
            print(f"Error listing saved searches: {e}")
            return []