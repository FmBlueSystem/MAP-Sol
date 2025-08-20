// Safe DOM Manipulation Utility
// Prevents XSS attacks by sanitizing HTML and using safe DOM methods

class SafeDOM {
    constructor() {
        // HTML entities that need escaping
        this.escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;',
        };

        // Allowed HTML tags for rich content
        this.allowedTags = ['b', 'i', 'em', 'strong', 'span', 'br'];

        // Allowed attributes
        this.allowedAttributes = ['class', 'id', 'data-id', 'data-track-id'];

        // Cache DOM elements
        this.elementCache = new Map();
    }

    // Escape HTML to prevent XSS
    escapeHTML(text) {
        if (typeof text !== 'string') {
            return '';
        }

        return text.replace(/[&<>"'`=\/]/g, (char) => {
            return this.escapeMap[char] || char;
        });
    }

    // Set text content safely
    setText(selector, text) {
        const element = this.getElement(selector);
        if (element) {
            element.textContent = String(text || '');
        }
        return element;
    }

    // Set HTML content safely (with sanitization)
    setHTML(selector, html, options = {}) {
        const element = this.getElement(selector);
        if (!element) {
            return null;
        }

        if (options.trusted) {
            // Only use for content we absolutely control
            element.innerHTML = html;
        } else {
            // Sanitize the HTML
            const sanitized = this.sanitizeHTML(html);
            element.innerHTML = sanitized;
        }

        return element;
    }

    // Sanitize HTML string
    sanitizeHTML(html) {
        if (typeof html !== 'string') {
            return '';
        }

        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Recursively clean all elements
        this.cleanElement(temp);

        return temp.innerHTML;
    }

    // Clean an element and its children
    cleanElement(element) {
        // Get all elements
        const allElements = element.querySelectorAll('*');

        for (const el of allElements) {
            // Remove disallowed tags
            if (!this.allowedTags.includes(el.tagName.toLowerCase())) {
                // Replace with text content
                const textNode = document.createTextNode(el.textContent);
                el.parentNode.replaceChild(textNode, el);
                continue;
            }

            // Remove disallowed attributes
            const attributes = Array.from(el.attributes);
            for (const attr of attributes) {
                if (!this.allowedAttributes.includes(attr.name)) {
                    el.removeAttribute(attr.name);
                }
            }

            // Remove event handlers
            this.removeEventHandlers(el);
        }
    }

    // Remove inline event handlers
    removeEventHandlers(element) {
        const attributes = Array.from(element.attributes);
        for (const attr of attributes) {
            if (attr.name.startsWith('on')) {
                element.removeAttribute(attr.name);
            }
        }
    }

    // Create element safely
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);

        // Set attributes safely
        for (const [key, value] of Object.entries(attributes)) {
            if (this.allowedAttributes.includes(key)) {
                element.setAttribute(key, this.escapeHTML(String(value)));
            } else if (key === 'textContent') {
                element.textContent = String(value);
            } else if (key === 'className') {
                element.className = this.escapeHTML(String(value));
            }
        }

        // Set content safely
        if (content) {
            if (typeof content === 'string') {
                element.textContent = content;
            } else if (content instanceof Element) {
                element.appendChild(content);
            }
        }

        return element;
    }

    // Append child safely
    appendChild(parentSelector, child) {
        const parent = this.getElement(parentSelector);
        if (!parent) {
            return null;
        }

        if (typeof child === 'string') {
            // Create text node for strings
            parent.appendChild(document.createTextNode(child));
        } else if (child instanceof Element) {
            parent.appendChild(child);
        }

        return parent;
    }

    // Replace element content safely
    replaceContent(selector, content) {
        const element = this.getElement(selector);
        if (!element) {
            return null;
        }

        // Clear existing content
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }

        // Add new content
        if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof Element) {
            element.appendChild(content);
        } else if (Array.isArray(content)) {
            const fragment = document.createDocumentFragment();
            content.forEach((item) => {
                if (typeof item === 'string') {
                    fragment.appendChild(document.createTextNode(item));
                } else if (item instanceof Element) {
                    fragment.appendChild(item);
                }
            });
            element.appendChild(fragment);
        }

        return element;
    }

    // Get element with caching
    getElement(selector) {
        if (typeof selector === 'string') {
            // Check cache first
            if (this.elementCache.has(selector)) {
                const cached = this.elementCache.get(selector);
                // Verify element still exists in DOM
                if (document.body.contains(cached)) {
                    return cached;
                } else {
                    this.elementCache.delete(selector);
                }
            }

            // Query and cache
            const element = document.querySelector(selector);
            if (element) {
                this.elementCache.set(selector, element);
            }
            return element;
        } else if (selector instanceof Element) {
            return selector;
        }
        return null;
    }

    // Get multiple elements
    getElements(selector) {
        return document.querySelectorAll(selector);
    }

    // Clear element cache
    clearCache() {
        this.elementCache.clear();
    }

    // Set attribute safely
    setAttribute(selector, name, value) {
        const element = this.getElement(selector);
        if (element && this.allowedAttributes.includes(name)) {
            element.setAttribute(name, this.escapeHTML(String(value)));
        }
        return element;
    }

    // Add class safely
    addClass(selector, className) {
        const element = this.getElement(selector);
        if (element) {
            const safe = this.escapeHTML(className);
            element.classList.add(safe);
        }
        return element;
    }

    // Remove class safely
    removeClass(selector, className) {
        const element = this.getElement(selector);
        if (element) {
            element.classList.remove(className);
        }
        return element;
    }

    // Toggle class safely
    toggleClass(selector, className) {
        const element = this.getElement(selector);
        if (element) {
            element.classList.toggle(className);
        }
        return element;
    }

    // Create track card safely
    createTrackCard(track) {
        const card = this.createElement('div', {
            className: 'track-card',
            'data-track-id': track.id,
        });

        // Create artwork safely
        if (track.artwork_path) {
            const img = this.createElement('img', {
                className: 'track-artwork',
            });
            img.src = track.artwork_path;
            img.onerror = () => {
                img.src = 'assets/default-album.png';
            };
            card.appendChild(img);
        }

        // Create title safely
        const title = this.createElement('div', {
            className: 'track-title',
            textContent: track.title || track.file_name || 'Unknown',
        });
        card.appendChild(title);

        // Create artist safely
        const artist = this.createElement('div', {
            className: 'track-artist',
            textContent: track.artist || 'Unknown Artist',
        });
        card.appendChild(artist);

        return card;
    }

    // Create table row safely
    createTableRow(track, index) {
        const row = this.createElement('tr', {
            'data-track-id': track.id,
        });

        const cells = [
            { content: index + 1, className: 'track-number' },
            { content: track.title || track.file_name, className: 'track-title' },
            { content: track.artist || 'Unknown', className: 'track-artist' },
            { content: track.album || '—', className: 'track-album' },
            { content: track.AI_BPM || '—', className: 'track-bpm' },
            { content: track.AI_KEY || '—', className: 'track-key' },
        ];

        cells.forEach((cellData) => {
            const td = this.createElement('td', {
                className: cellData.className,
                textContent: cellData.content,
            });
            row.appendChild(td);
        });

        return row;
    }

    // Batch update for performance
    batchUpdate(updates) {
        // Use DocumentFragment for batch DOM updates
        const fragment = document.createDocumentFragment();

        updates.forEach((update) => {
            if (update.type === 'create') {
                const element = this.createElement(update.tag, update.attributes, update.content);
                fragment.appendChild(element);
            }
        });

        return fragment;
    }

    // Remove element safely
    removeElement(selector) {
        const element = this.getElement(selector);
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
            // Clear from cache
            if (typeof selector === 'string') {
                this.elementCache.delete(selector);
            }
        }
    }

    // Clear all children safely
    clearChildren(selector) {
        const element = this.getElement(selector);
        if (element) {
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        }
    }
}

// Create global instance
window.safeDOM = new SafeDOM();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SafeDOM;
}
