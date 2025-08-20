/**
 * DEBUG SCRIPT - DISABLED
 * This old debug code is no longer needed
 */

// DISABLED - Old debug code
if (false) {
    logDebug('=== ENHANCED BUTTON DEBUG ===');

    // Wait for DOM to load
    setTimeout(() => {
        logDebug('1. Looking for enhanced button...');

        // Find all view buttons
        const allViewButtons = document.querySelectorAll('.view-btn');
        logDebug(`Found ${allViewButtons.length} view buttons total`);

        // Look specifically for enhanced button
        const enhancedButton = document.querySelector('[data-view="enhanced"]');
        if (enhancedButton) {
            logInfo('✅ Enhanced button FOUND in DOM');
            logDebug('Button HTML:', enhancedButton.outerHTML);
            logDebug('Button onclick:', enhancedButton.onclick);

            // Check if it's visible
            const rect = enhancedButton.getBoundingClientRect();
            logDebug('Button position:', rect);
            logDebug('Is visible?', rect.width > 0 && rect.height > 0);

            // Check if it's clickable
            const styles = window.getComputedStyle(enhancedButton);
            logDebug('Display:', styles.display);
            logDebug('Visibility:', styles.visibility);
            logDebug('Pointer events:', styles.pointerEvents);

            // Try to add a simple click listener
            enhancedButton.addEventListener('click', function (e) {
                logDebug('🔴 ENHANCED BUTTON CLICKED via addEventListener!');
                alert('Button clicked via addEventListener!');
            });
            logDebug('Added click listener to button');
        } else {
            logError('❌ Enhanced button NOT FOUND in DOM');
            logDebug(
                'Available buttons:',
                Array.from(allViewButtons).map((b) => b.textContent)
            );
        }

        // Check if showEnhancedView exists
        logDebug('2. Checking for showEnhancedView function...');
        if (typeof showEnhancedView === 'function') {
            logInfo('✅ showEnhancedView function exists');
        } else {
            logError('❌ showEnhancedView function NOT found');
        }

        // Check if filesContainer exists
        logDebug('3. Checking for filesContainer...');
        const container = document.getElementById('filesContainer');
        if (container) {
            logInfo('✅ filesContainer found');
        } else {
            logError('❌ filesContainer NOT found');
        }

        // List all global functions
        logDebug('4. Available global functions:');
        const globalFuncs = Object.keys(window).filter((key) => typeof window[key] === 'function');
        logDebug('Total functions:', globalFuncs.length);
        if (globalFuncs.includes('showEnhancedView')) {
            logInfo('✅ showEnhancedView is in global scope');
        }

        logDebug('=== DEBUG COMPLETE ===');
    }, 2000); // Wait 2 seconds for everything to load
} // End of disabled code
