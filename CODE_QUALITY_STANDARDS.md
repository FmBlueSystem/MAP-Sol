# 📋 CODE QUALITY STANDARDS - MAP Sol

## ⚠️ MANDATORY RULES - MUST FOLLOW

### 1. ✅ SYNTAX VALIDATION
**BEFORE SAVING ANY CODE:**
- Run `node -c filename.js` to check syntax
- Fix ALL errors before committing
- Test the code actually runs

### 2. 🎯 INDENTATION RULES
```javascript
// ✅ CORRECT
if (condition) {
    doSomething();
}

// ❌ WRONG
if (condition) {
doSomething();
}
```

### 3. 📝 TEMPLATE LITERALS
```javascript
// ✅ CORRECT - Use backticks properly
const message = `Hello ${name}`;

// ❌ WRONG - Don't mix quotes
const message = `Hello ${name}';
```

### 4. 🔧 IF/ELSE STRUCTURE
```javascript
// ✅ CORRECT
if (condition) {
    // code
} else {
    // code
}

// ❌ WRONG
if (condition) {
    // code
    } else {
    // code
    }
```

### 5. 🎨 HTML IN JAVASCRIPT
```javascript
// ✅ CORRECT - Complete template literal
element.innerHTML = `
    <div class="example">
        Content
    </div>
`;

// ❌ WRONG - Mixed quotes
element.innerHTML = `
    <div class="example">
        Content
    </div>
";
```

## 🔍 QUALITY CHECKLIST

### Before ANY code change:
- [ ] Syntax validated with `node -c`
- [ ] Indentation consistent (4 spaces)
- [ ] All brackets properly closed
- [ ] Template literals use backticks
- [ ] No mixed quote types
- [ ] Code actually tested

### Before commit:
- [ ] Run the app and verify no console errors
- [ ] Test the specific feature changed
- [ ] Check for duplicate code
- [ ] Remove console.log statements

## 🚨 COMMON MISTAKES TO AVOID

1. **Mixed indentation** - Some lines at wrong level
2. **Unclosed strings** - Missing closing quote/backtick
3. **Double brackets** - `if (x) { {` instead of `if (x) {`
4. **Template literal errors** - Using ' or " to close \`
5. **Copy-paste errors** - Pasting without checking context

## 🛠️ TOOLS TO USE

### Validation:
```bash
# Check JavaScript syntax
node -c path/to/file.js

# Check all JS files
for f in js/*.js; do node -c "$f"; done
```

### Formatting:
```bash
# Install prettier (if not installed)
npm install -g prettier

# Format a file
prettier --write path/to/file.js
```

## 📊 QUALITY METRICS

### Acceptable:
- ✅ 0 syntax errors
- ✅ Consistent indentation
- ✅ All tests pass
- ✅ No console errors

### Unacceptable:
- ❌ ANY syntax error
- ❌ Mixed indentation
- ❌ Broken functionality
- ❌ Untested code

## 🎯 ENFORCEMENT

**NO CODE MERGES** if:
1. Syntax errors exist
2. Indentation is inconsistent
3. Tests fail
4. Console shows errors

## 📝 EXAMPLE OF CLEAN CODE

```javascript
class AudioPanel {
    constructor() {
        this.isInitialized = false;
        this.audioContext = null;
    }

    init() {
        if (!this.isInitialized) {
            this.audioContext = new AudioContext();
            this.isInitialized = true;
        }
    }

    updateDisplay(track) {
        const titleEl = document.getElementById('title');
        if (titleEl) {
            titleEl.textContent = track.title || 'Unknown';
        }
    }

    destroy() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.isInitialized = false;
    }
}
```

---

**REMEMBER**: Quality > Speed. Better to write less code that works than more code with errors.

**Last Updated**: 2025-08-20
**Enforced Starting**: NOW