// Safe HTML Replacer - Automatically replaces innerHTML with safe alternatives
class SafeHTMLReplacer {
    constructor() {
        this.replacements = 0;
        this.originalInnerHTML = Element.prototype.__lookupSetter__('innerHTML');
        this.setupSafeReplacements();
    }

    setupSafeReplacements() {
        // Override innerHTML setter globally
        Object.defineProperty(Element.prototype, 'innerHTML', {
            set: function (html) {
                // Check if it's safe HTML (no scripts, events, etc.)
                if (SafeHTMLReplacer.isSafeHTML(html)) {
                    // Use original innerHTML for safe content
                    this.originalInnerHTML?.call(this, html);
                } else {
                    // Use safe alternative
                    SafeHTMLReplacer.safeSetHTML(this, html);
                }
            },
            get: function () {
                return this.originalInnerHTML;
            },
        });

        // Add safe methods to elements
        Element.prototype.safeSetHTML = function (html) {
            SafeHTMLReplacer.safeSetHTML(this, html);
        };

        Element.prototype.safeAppendHTML = function (html) {
            SafeHTMLReplacer.safeAppendHTML(this, html);
        };
    }

    static isSafeHTML(html) {
        if (typeof html !== 'string') {
            return true;
        }

        // Check for dangerous patterns
        const dangerousPatterns = [
            /<script/i,
            /<iframe/i,
            /<object/i,
            /<embed/i,
            /<link/i,
            /javascript:/i,
            /on\w+\s*=/i, // Event handlers
            /<style/i,
            /data:text\/html/i,
        ];

        return !dangerousPatterns.some((pattern) => pattern.test(html));
    }

    static safeSetHTML(element, html) {
        // Clear element safely
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }

        // Parse and sanitize HTML
        const sanitized = SafeHTMLReplacer.sanitizeHTML(html);

        // Create safe elements
        const template = document.createElement('template');
        template.innerHTML = sanitized;

        // Clone and append sanitized content
        const content = template.content.cloneNode(true);
        element.appendChild(content);
    }

    static safeAppendHTML(element, html) {
        const sanitized = SafeHTMLReplacer.sanitizeHTML(html);
        const template = document.createElement('template');
        template.innerHTML = sanitized;
        const content = template.content.cloneNode(true);
        element.appendChild(content);
    }

    static sanitizeHTML(html) {
        if (typeof html !== 'string') {
            return '';
        }

        // Remove dangerous elements and attributes
        const sanitized = html
            // Remove script tags
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            // Remove on* event attributes
            .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')
            // Remove javascript: protocol
            .replace(/javascript:/gi, '')
            // Remove data URIs with HTML
            .replace(/data:text\/html[^"']*/gi, '')
            // Remove iframes
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            // Remove object/embed tags
            .replace(/<(object|embed)\b[^<]*(?:(?!<\/(object|embed)>)<[^<]*)*<\/(object|embed)>/gi, '');

        return sanitized;
    }

    // Create safe DOM elements
    static createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);

        // Set safe attributes
        for (const [key, value] of Object.entries(attributes)) {
            if (key.startsWith('on')) {
                continue;
            } // Skip event handlers
            if (key === 'href' && value.startsWith('javascript:')) {
                continue;
            }

            element.setAttribute(key, value);
        }

        // Set safe content
        if (content) {
            if (typeof content === 'string') {
                element.textContent = content;
            } else if (content instanceof Node) {
                element.appendChild(content);
            }
        }

        return element;
    }

    // Safe text content setter
    static setText(element, text) {
        element.textContent = text;
    }

    // Safe HTML builder
    static buildHTML(structure) {
        if (!structure) {
            return null;
        }

        const { tag, attributes = {}, children = [], text } = structure;
        const element = SafeHTMLReplacer.createElement(tag, attributes);

        if (text) {
            element.textContent = text;
        }

        if (Array.isArray(children)) {
            children.forEach((child) => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else if (child instanceof Node) {
                    element.appendChild(child);
                } else if (typeof child === 'object') {
                    const childElement = SafeHTMLReplacer.buildHTML(child);
                    if (childElement) {
                        element.appendChild(childElement);
                    }
                }
            });
        }

        return element;
    }

    // Replace innerHTML in existing code
    static replaceInnerHTMLCalls(code) {
        // This would be used in a build process
        return code
            .replace(/\.innerHTML\s*=\s*/g, '.safeSetHTML(')
            .replace(/\.innerHTML\s*\+=\s*/g, '.safeAppendHTML(');
    }

    // Get statistics
    getStats() {
        return {
            replacements: this.replacements,
            safeMode: true,
        };
    }
}

// Initialize safe HTML replacer
window.safeHTMLReplacer = new SafeHTMLReplacer();

// Export safe functions
window.safeHTML = {
    set: SafeHTMLReplacer.safeSetHTML,
    append: SafeHTMLReplacer.safeAppendHTML,
    sanitize: SafeHTMLReplacer.sanitizeHTML,
    createElement: SafeHTMLReplacer.createElement,
    setText: SafeHTMLReplacer.setText,
    build: SafeHTMLReplacer.buildHTML,
};

// Polyfill for Sanitizer API if available
if (typeof window.Sanitizer !== 'undefined') {
    window.sanitizer = new Sanitizer();

    Element.prototype.setHTML = function (html) {
        this.innerHTML = window.sanitizer.sanitize(html);
    };
}
