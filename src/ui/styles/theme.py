#!/usr/bin/env python3
"""
Unified theme for Music App (Qt).
Use apply_global_theme(widget) to set base styles.
"""

PALETTE = {
    'bg': '#121212',            # main background
    'bg_elev': '#0a0a0a',       # elevated surfaces (player bar)
    'panel': '#1f2937',         # panels/cards
    'border': '#282828',        # borders/dividers
    'hover': 'rgba(255,255,255,0.06)',
    'text': '#ffffff',          # primary text
    'text_muted': '#b3b3b3',    # secondary text
    'accent': '#00d4aa',        # primary accent
    'accent_hover': '#00e8bb',  # accent hover
}


def base_qss(p=PALETTE):
    return f"""
    QWidget {{
        background: {p['bg']};
        color: {p['text']};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
    }}
    QMainWindow {{ background: {p['bg']}; }}
    QLabel {{ background: transparent; }}
    QMenuBar {{ background: {p['bg_elev']}; color: {p['text']}; }}
    QMenu {{ background: {p['panel']}; color: {p['text']}; border: 1px solid {p['border']}; }}
    QMenu::item:selected {{ background: {p['hover']}; }}

    /* Buttons */
    QPushButton {{
        background: transparent;
        color: {p['text']};
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
    }}
    QPushButton:hover {{ background: {p['hover']}; }}

    /* Inputs */
    QLineEdit {{
        background: #1a1a1a;
        border: 1px solid {p['border']};
        border-radius: 16px;
        padding: 8px 12px;
        color: {p['text']};
    }}
    QLineEdit:focus {{ border: 1px solid {p['accent']}; }}

    /* Lists */
    QListWidget, QTreeWidget {{ background: {p['bg']}; border: none; color: {p['text']}; }}
    QListWidget::item {{ padding: 8px; border-bottom: 1px solid #1a1a2e; }}
    QListWidget::item:hover {{ background: #1a1a2e; }}
    QListWidget::item:selected {{ background: {p['accent']}; color: {p['bg']}; }}
    QTreeWidget::item {{ padding: 6px; }}
    QTreeWidget::item:hover {{ background: #1a1a2e; }}
    QTreeWidget::item:selected {{ background: {p['accent']}; color: {p['bg']}; }}

    /* Tabs */
    QTabWidget::pane {{ background: {p['bg']}; border: 1px solid #1a1a2e; }}
    QTabBar::tab {{ background: #1a1a2e; color: #808080; padding: 8px 14px; margin-right: 2px; }}
    QTabBar::tab:selected {{ background: {p['accent']}; color: {p['bg']}; }}

    /* Toolbars */
    QToolBar {{ background: #1a1a2e; border: none; padding: 5px; }}

    /* Sliders */
    QSlider::groove:horizontal {{ height: 6px; background: #1f2937; border-radius: 3px; }}
    QSlider::sub-page:horizontal {{ background: {p['accent']}; border-radius: 3px; }}
    QSlider::handle:horizontal {{ width: 14px; height: 14px; margin: -4px 0; border-radius: 7px; background: {p['accent']}; }}
    """


def apply_global_theme(widget):
    widget.setStyleSheet(base_qss())

