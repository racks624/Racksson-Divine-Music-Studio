# utils/theme_engine.py
class ThemeEngine:
    def __init__(self):
        # default theme config exposed to templates
        self._theme = {
            'name': 'golden',
            'background': '#07020a',
            'foreground': '#ffffff',
            'accent': '#D4AF37',
            'button_primary': '#D4AF37',
            'button_text': '#000000'
        }

    def get_theme(self):
        return self._theme

    def set_theme(self, name):
        if name == 'indigo':
            self._theme.update({'name':'indigo','button_primary':'#B68DFF'})
        elif name == 'violet':
            self._theme.update({'name':'violet','button_primary':'#E6C9FF'})
        else:
            self._theme.update({'name':'golden','button_primary':'#D4AF37'})
        return self._theme