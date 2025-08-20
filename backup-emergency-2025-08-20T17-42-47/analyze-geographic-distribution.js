/**
 * GEOGRAPHIC DISTRIBUTION ANALYZER
 * Analiza la distribución geográfica de la biblioteca musical usando ISRC
 * Genera estadísticas y agrupa por país/región/era
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class GeographicAnalyzer {
    constructor() {
        this.dbPath = path.join(__dirname, 'music_analyzer.db');
        this.db = null;

        // Country code mappings
        this.countries = {
            US: { name: 'United States', region: 'North America', emoji: '🇺🇸' },
            GB: { name: 'United Kingdom', region: 'Europe', emoji: '🇬🇧' },
            DE: { name: 'Germany', region: 'Europe', emoji: '🇩🇪' },
            FR: { name: 'France', region: 'Europe', emoji: '🇫🇷' },
            ES: { name: 'Spain', region: 'Europe', emoji: '🇪🇸' },
            IT: { name: 'Italy', region: 'Europe', emoji: '🇮🇹' },
            NL: { name: 'Netherlands', region: 'Europe', emoji: '🇳🇱' },
            BE: { name: 'Belgium', region: 'Europe', emoji: '🇧🇪' },
            SE: { name: 'Sweden', region: 'Europe', emoji: '🇸🇪' },
            NO: { name: 'Norway', region: 'Europe', emoji: '🇳🇴' },
            DK: { name: 'Denmark', region: 'Europe', emoji: '🇩🇰' },
            FI: { name: 'Finland', region: 'Europe', emoji: '🇫🇮' },
            CH: { name: 'Switzerland', region: 'Europe', emoji: '🇨🇭' },
            AT: { name: 'Austria', region: 'Europe', emoji: '🇦🇹' },
            PL: { name: 'Poland', region: 'Europe', emoji: '🇵🇱' },
            CA: { name: 'Canada', region: 'North America', emoji: '🇨🇦' },
            MX: { name: 'Mexico', region: 'Latin America', emoji: '🇲🇽' },
            BR: { name: 'Brazil', region: 'Latin America', emoji: '🇧🇷' },
            AR: { name: 'Argentina', region: 'Latin America', emoji: '🇦🇷' },
            CL: { name: 'Chile', region: 'Latin America', emoji: '🇨🇱' },
            CO: { name: 'Colombia', region: 'Latin America', emoji: '🇨🇴' },
            AU: { name: 'Australia', region: 'Oceania', emoji: '🇦🇺' },
            NZ: { name: 'New Zealand', region: 'Oceania', emoji: '🇳🇿' },
            JP: { name: 'Japan', region: 'Asia', emoji: '🇯🇵' },
            KR: { name: 'South Korea', region: 'Asia', emoji: '🇰🇷' },
            CN: { name: 'China', region: 'Asia', emoji: '🇨🇳' },
            IN: { name: 'India', region: 'Asia', emoji: '🇮🇳' },
            RU: { name: 'Russia', region: 'Europe/Asia', emoji: '🇷🇺' },
            ZA: { name: 'South Africa', region: 'Africa', emoji: '🇿🇦' },
            NG: { name: 'Nigeria', region: 'Africa', emoji: '🇳🇬' },
            EG: { name: 'Egypt', region: 'Africa', emoji: '🇪🇬' }
        };
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, err => {
                if (err) {
                    reject(err);
                } else {
                    logInfo('✅ Connected to database');
                    resolve();
                }
            });
        });
    }

    /**
     * Get ISRC statistics
     */
    async getISRCStats() {
        return new Promise((resolve, reject) => {
            this.db.get(
                `
                SELECT 
                    COUNT(*) as total_tracks,
                    COUNT(CASE WHEN isrc IS NOT NULL AND isrc != '[object Object]' AND LENGTH(isrc) = 12 THEN 1 END) as valid_isrc,
                    ROUND(COUNT(CASE WHEN isrc IS NOT NULL AND isrc != '[object Object]' AND LENGTH(isrc) = 12 THEN 1 END) * 100.0 / COUNT(*), 1) as coverage_percentage
                FROM audio_files
            `,
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    /**
     * Analyze by country
     */
    async analyzeByCountry() {
        const countries = await new Promise((resolve, reject) => {
            this.db.all(
                `
                SELECT 
                    SUBSTR(isrc, 1, 2) as country_code,
                    COUNT(*) as track_count,
                    COUNT(DISTINCT artist) as artist_count,
                    COUNT(DISTINCT genre) as genre_count,
                    MIN(CAST(SUBSTR(isrc, 6, 2) as INTEGER)) as earliest_year,
                    MAX(CAST(SUBSTR(isrc, 6, 2) as INTEGER)) as latest_year,
                    GROUP_CONCAT(DISTINCT genre) as genres
                FROM audio_files
                WHERE isrc IS NOT NULL 
                  AND isrc != '[object Object]'
                  AND LENGTH(isrc) = 12
                GROUP BY country_code
                ORDER BY track_count DESC
            ',
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });

        // Process and enrich country data
        return countries.map(row => {
            const countryInfo = this.countries[row.country_code] || {
                name: row.country_code,
                region: 'Unknown',
                emoji: '🌍'
            };

            // Convert year codes to full years
            const earliestYear =
                row.earliest_year > 50 ? 1900 + row.earliest_year : 2000 + row.earliest_year;
            const latestYear =
                row.latest_year > 50 ? 1900 + row.latest_year : 2000 + row.latest_year;

            // Parse top genres
            const genres = row.genres ? row.genres.split(',`).slice(0, 3) : [];

            return {
                code: row.country_code,
                name: countryInfo.name,
                region: countryInfo.region,
                emoji: countryInfo.emoji,
                tracks: row.track_count,
                artists: row.artist_count,
                genres: row.genre_count,
                topGenres: genres,
                yearRange: `${earliestYear}-${latestYear}`
            };
        });
    }

    /**
     * Analyze by region
     */
    async analyzeByRegion(countryData) {
        const regions = {};

        countryData.forEach(country => {
            if (!regions[country.region]) {
                regions[country.region] = {
                    name: country.region,
                    countries: [],
                    totalTracks: 0,
                    totalArtists: 0,
                    topGenres: new Set()
                };
            }

            regions[country.region].countries.push(country.emoji + ' ` + country.name);
            regions[country.region].totalTracks += country.tracks;
            regions[country.region].totalArtists += country.artists;
            country.topGenres.forEach(genre => regions[country.region].topGenres.add(genre));
        });

        return Object.values(regions)
            .map(region => ({
                ...region,
                topGenres: Array.from(region.topGenres).slice(0, 5)
            }))
            .sort((a, b) => b.totalTracks - a.totalTracks);
    }

    /**
     * Analyze by era/decade
     */
    async analyzeByEra() {
        const eras = await new Promise((resolve, reject) => {
            this.db.all(
                `
                SELECT 
                    CASE 
                        WHEN CAST(SUBSTR(isrc, 6, 2) as INTEGER) >= 80 AND CAST(SUBSTR(isrc, 6, 2) as INTEGER) <= 89 THEN '1980s'
                        WHEN CAST(SUBSTR(isrc, 6, 2) as INTEGER) >= 90 AND CAST(SUBSTR(isrc, 6, 2) as INTEGER) <= 99 THEN '1990s'
                        WHEN CAST(SUBSTR(isrc, 6, 2) as INTEGER) >= 0 AND CAST(SUBSTR(isrc, 6, 2) as INTEGER) <= 9 THEN '2000s'
                        WHEN CAST(SUBSTR(isrc, 6, 2) as INTEGER) >= 10 AND CAST(SUBSTR(isrc, 6, 2) as INTEGER) <= 19 THEN '2010s'
                        WHEN CAST(SUBSTR(isrc, 6, 2) as INTEGER) >= 20 AND CAST(SUBSTR(isrc, 6, 2) as INTEGER) <= 29 THEN '2020s'
                        ELSE 'Unknown'
                    END as decade,
                    COUNT(*) as track_count,
                    COUNT(DISTINCT artist) as artist_count,
                    GROUP_CONCAT(DISTINCT SUBSTR(isrc, 1, 2)) as countries,
                    GROUP_CONCAT(DISTINCT genre) as genres
                FROM audio_files
                WHERE isrc IS NOT NULL 
                  AND isrc != '[object Object]'
                  AND LENGTH(isrc) = 12
                GROUP BY decade
                ORDER BY decade
            ',
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });

        return eras.map(era => ({
            decade: era.decade,
            tracks: era.track_count,
            artists: era.artist_count,
            countries: era.countries ? era.countries.split(',').length : 0,
            topGenres: era.genres ? era.genres.split(',`).slice(0, 5) : []
        }));
    }

    /**
     * Get top tracks by country for AI enrichment
     */
    async getTracksForEnrichment(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `
                SELECT 
                    af.id,
                    af.title,
                    af.artist,
                    af.genre,
                    af.isrc,
                    SUBSTR(af.isrc, 1, 2) as country_code,
                    SUBSTR(af.isrc, 6, 2) as year_code,
                    lm.LLM_ANALYZED,
                    lm.AI_ENERGY,
                    lm.AI_BPM
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.isrc IS NOT NULL 
                  AND af.isrc != '[object Object]'
                  AND LENGTH(af.isrc) = 12
                  AND (lm.LLM_ANALYZED = 0 OR lm.LLM_ANALYZED IS NULL OR lm.LLM_DESCRIPTION IS NULL)
                ORDER BY 
                    -- Prioritize by country diversity
                    CASE SUBSTR(af.isrc, 1, 2)
                        WHEN 'US' THEN 1
                        WHEN 'GB' THEN 2
                        WHEN 'DE' THEN 3
                        WHEN 'NL' THEN 4
                        WHEN 'FR' THEN 5
                        ELSE 6
                    END,
                    -- Then by decade
                    CAST(SUBSTR(af.isrc, 6, 2) as INTEGER),
                    -- Then by energy if available
                    lm.AI_ENERGY DESC
                LIMIT ?
            ',
                [limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    /**
     * Generate comprehensive report
     */
    async generateReport() {
        logDebug('\n🌍 GEOGRAPHIC DISTRIBUTION ANALYSIS');
        logDebug('='.repeat(60));

        // Get ISRC coverage
        const stats = await this.getISRCStats();
        logDebug('\n📊 ISRC Coverage:`);
        logDebug(`   Total tracks: ${stats.total_tracks}`);
        logDebug(`   Valid ISRCs: ${stats.valid_isrc}`);
        logDebug(`   Coverage: ${stats.coverage_percentage}%`);

        // Analyze by country
        const countryData = await this.analyzeByCountry();
        logDebug('\n🗺️ Distribution by Country:');
        logDebug('─`.repeat(60));

        countryData.slice(0, 10).forEach((country, i) => {
            logDebug(`${i + 1}. ${country.emoji} ${country.name} (${country.code})`);
            logDebug(`   Tracks: ${country.tracks} | Artists: ${country.artists}`);
            logDebug(`   Years: ${country.yearRange}`);
            logDebug(`   Top genres: ${country.topGenres.join(`, ')}');
            logDebug('');
        });

        // Analyze by region
        const regionData = await this.analyzeByRegion(countryData);
        logDebug('🌐 Distribution by Region:');
        logDebug(`─`.repeat(60));

        regionData.forEach(region => {
            logDebug(`\n${region.name}:`);
            logDebug(`   Tracks: ${region.totalTracks}`);
            logDebug(`   Countries: ${region.countries.join(`, `)}`);
            logDebug(`   Top genres: ${region.topGenres.join(`, ')}');
        });

        // Analyze by era
        const eraData = await this.analyzeByEra();
        logDebug('\n📅 Distribution by Era:');
        logDebug(`─`.repeat(60));

        eraData.forEach(era => {
            logDebug(`\n${era.decade}:`);
            logDebug(`   Tracks: ${era.tracks} | Artists: ${era.artists}`);
            logDebug(`   Countries represented: ${era.countries}`);
            logDebug(`   Popular genres: ${era.topGenres.join(`, ')}');
        });

        // Get tracks for enrichment
        const enrichmentTracks = await this.getTracksForEnrichment(20);
        logDebug('\n🎯 Priority Tracks for AI Enrichment:');
        logDebug('─'.repeat(60));
        logDebug(`(Prioritized by country diversity and era)\n`);

        enrichmentTracks.slice(0, 10).forEach((track, i) => {
            const country = this.countries[track.country_code];
            const year = track.year_code > 50 ? `19${track.year_code}` : `20${track.year_code}`;
            logDebug(`${i + 1}. "${track.title}` by ${track.artist}`);
            logDebug(
                `   ${country?.emoji || '🌍`} ${country?.name || track.country_code} (${year})`);
            logDebug(`   Genre: ${track.genre || 'Unknown`}`);
            if (track.AI_ENERGY) {
                logDebug(
                    `   Energy: ${(track.AI_ENERGY * 100).toFixed(0)}% | BPM: ${track.AI_BPM || 'N/A'}');
            }
            logDebug('');
        });

        // Save report to file
        const report = {
            generated: new Date().toISOString(),
            stats,
            countries: countryData,
            regions: regionData,
            eras: eraData,
            enrichmentPriority: enrichmentTracks
        };

        await fs.writeFile('geographic-analysis-report.json', JSON.stringify(report, null, 2));

        logDebug('='.repeat(60));
        logInfo('✅ Full report saved to: geographic-analysis-report.json');

        return report;
    }

    close() {
        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const analyzer = new GeographicAnalyzer();

    (async () => {
        await analyzer.init();
        await analyzer.generateReport();
        analyzer.close();

        logDebug(`\n✨ Analysis complete!\n`);
    })().catch(console.error);
}

module.exports = { GeographicAnalyzer };
