# Chakra frequencies mapping (in Hz)
CHAKRA_FREQUENCIES = {
    'root': 432.0,
    'sacral': 480.0,
    'solar_plexus': 528.0,
    'heart': 594.0,
    'throat': 672.0,
    'third_eye': 720.0,
    'crown': 768.0,
}

def get_chakra_frequency(chakra_name):
    return CHAKRA_FREQUENCIES.get(chakra_name.lower(), 432.0)

def get_all_chakras():
    return CHAKRA_FREQUENCIES
