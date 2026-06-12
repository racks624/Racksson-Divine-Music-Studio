# utils/frequency_utils.py - small harmony generator based on a root frequency
def generate_harmony(base_frequency=432.0, scale='minor'):
    # simple harmonic stack builder
    base = float(base_frequency)
    if scale == 'major':
        intervals = [0, 4, 7, 12]
    else:
        intervals = [0, 3, 7, 12]
    # convert semitone intervals to frequency multipliers
    freqs = [ base * (2 ** (i/12)) for i in intervals ]
    return {'base':base, 'notes': freqs, 'scale': scale}