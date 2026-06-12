# utils/visualizer_engine.py - small helper to expose FFT bucket ranges for UI display
def fft_bands(sample_rate=44100, nfft=2048):
    # return label and frequency boundaries for a few bands
    freqs = [ (0,200,'subbass'), (200,500,'bass'), (500,2000,'lowmid'), (2000,6000,'highmid'), (6000,20000,'air') ]
    return freqs