#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const mm = require('music-metadata');

async function fixMetadataExtraction() {
    console.log('🔧 FIXING METADATA EXTRACTION');
    console.log('=' .repeat(50));
    
    // Read error file
    const errors = JSON.parse(fs.readFileSync('metadata-errors.json', 'utf8'));
    console.log(`Found ${errors.length} failed files to process`);
    
    // Connect to database
    const db = new sqlite3.Database('./music_analyzer.db');
    console.log('✅ Connected to database');
    
    let successCount = 0;
    let failCount = 0;
    
    // Process each file
    for (let i = 0; i < errors.length; i++) {
        const errorItem = errors[i];
        // The error shows that path is an object, get the actual path string
        const filePath = errorItem.path.path;
        const fileName = errorItem.path.filename;
        
        if (i % 50 === 0) {
            console.log(`\n📦 Processing: ${i}/${errors.length} (${(i/errors.length*100).toFixed(1)}%)`);
        }
        
        try {
            // Extract metadata
            const metadata = await mm.parseFile(filePath);
            const stats = fs.statSync(filePath);
            
            // Prepare data
            const track = {
                file_path: filePath,
                file_name: fileName,
                title: metadata.common.title || path.basename(fileName, path.extname(fileName)),
                artist: metadata.common.artist || 'Unknown Artist',
                album: metadata.common.album || 'Unknown Album',
                album_artist: metadata.common.albumartist || metadata.common.artist || null,
                genre: metadata.common.genre ? metadata.common.genre.join(', ') : null,
                year: metadata.common.year || null,
                track_number: metadata.common.track?.no || null,
                total_tracks: metadata.common.track?.of || null,
                disc_number: metadata.common.disk?.no || null,
                total_discs: metadata.common.disk?.of || null,
                duration: metadata.format.duration || null,
                bitrate: metadata.format.bitrate || null,
                sample_rate: metadata.format.sampleRate || null,
                codec: metadata.format.codec || null,
                file_extension: path.extname(filePath),
                file_size: stats.size,
                date_modified: stats.mtime.toISOString(),
                bpm: metadata.common.bpm || metadata.native?.ID3v24?.find(tag => tag.id === 'TBPM')?.value || null,
                key: metadata.native?.ID3v24?.find(tag => tag.id === 'TKEY')?.value || null,
                comment: metadata.common.comment ? metadata.common.comment.join(' ') : null,
                rating: metadata.common.rating ? metadata.common.rating[0].rating : null,
                file_hash: null, // Skip for speed
                has_artwork: metadata.common.picture && metadata.common.picture.length > 0 ? 1 : 0,
                artwork_format: metadata.common.picture?.[0]?.format || null,
                channels: metadata.format.numberOfChannels || null,
                bits_per_sample: metadata.format.bitsPerSample || null,
                lossless: metadata.format.lossless ? 1 : 0,
                compilation: metadata.common.compilation ? 1 : 0,
                publisher: metadata.common.label ? metadata.common.label.join(', ') : null,
                isrc: metadata.common.isrc ? metadata.common.isrc.join(', ') : null,
                copyright: metadata.common.copyright || null,
                encoded_by: metadata.common.encodedby || null,
                encoding_date: metadata.common.date || null,
                tagging_date: metadata.common.taggingTime || null,
                lyrics: metadata.common.lyrics ? metadata.common.lyrics.join('\n') : null,
                mood: null,
                energy: null,
                existing_bmp: metadata.common.bpm || null
            };
            
            // Insert into database
            await new Promise((resolve, reject) => {
                const sql = `
                    INSERT OR REPLACE INTO audio_files_import (
                        file_path, file_name, title, artist, album, album_artist,
                        genre, year, track_number, total_tracks, disc_number, total_discs,
                        duration, bitrate, sample_rate, codec, file_extension, file_size,
                        date_modified, bpm, key, comment, rating, file_hash,
                        has_artwork, artwork_format, channels, bits_per_sample, lossless,
                        compilation, publisher, isrc, copyright, encoded_by,
                        encoding_date, tagging_date, lyrics, mood, energy, existing_bmp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                const values = [
                    track.file_path, track.file_name, track.title, track.artist,
                    track.album, track.album_artist, track.genre, track.year,
                    track.track_number, track.total_tracks, track.disc_number,
                    track.total_discs, track.duration, track.bitrate,
                    track.sample_rate, track.codec, track.file_extension,
                    track.file_size, track.date_modified, track.bpm, track.key,
                    track.comment, track.rating, track.file_hash, track.has_artwork,
                    track.artwork_format, track.channels, track.bits_per_sample,
                    track.lossless, track.compilation, track.publisher, track.isrc,
                    track.copyright, track.encoded_by, track.encoding_date,
                    track.tagging_date, track.lyrics, track.mood, track.energy,
                    track.existing_bmp
                ];
                
                db.run(sql, values, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            successCount++;
        } catch (error) {
            console.error(`❌ Failed: ${fileName} - ${error.message}`);
            failCount++;
        }
    }
    
    // Close database
    db.close();
    
    console.log('\n' + '=' .repeat(50));
    console.log('📊 METADATA FIX COMPLETE');
    console.log('=' .repeat(50));
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    
    if (successCount > 0) {
        // Clear the error file
        fs.writeFileSync('metadata-errors.json', '[]');
        console.log('✅ Cleared error file');
    }
}

fixMetadataExtraction().catch(console.error);