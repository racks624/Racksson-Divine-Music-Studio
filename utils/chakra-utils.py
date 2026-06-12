# utils/chakra_utils.py - chakra definitions and utilities
CHAKRAS = [
    {'id':'root','hz':139,'label':'Root - 139Hz','color':'#8B0000'},
    {'id':'sacral','hz':417,'label':'Sacral - 417Hz','color':'#FF8C00'},
    {'id':'solar','hz':528,'label':'Solar Plexus - 528Hz','color':'#FFD966'},
    {'id':'heart','hz':639,'label':'Heart - 639Hz','color':'#228B22'},
    {'id':'throat','hz':741,'label':'Throat - 741Hz','color':'#1E90FF'},
    {'id':'third','hz':852,'label':'Third Eye - 852Hz','color':'#7F00FF'},
    {'id':'crown','hz':963,'label':'Crown - 963Hz','color':'#FFD700'},
    {'id':'a432','hz':432,'label':'Natural A - 432Hz','color':'#00B894'}
]

class ChakraManager:
    def get_chakras(self):
        return CHAKRAS

    def find_by_id(self, id_):
        for c in CHAKRAS:
            if c['id'] == id_: return c
        return None