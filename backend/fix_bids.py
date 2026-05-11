from firebase_db import get_firestore_client, BIDS_COLLECTION

db = get_firestore_client()
bids = db.collection(BIDS_COLLECTION).stream()

for doc in bids:
    bid_data = doc.to_dict()
    if 'proposal' in bid_data and 'proposal_text' not in bid_data:
        bid_data['proposal_text'] = bid_data.pop('proposal')
        doc.reference.update({'proposal_text': bid_data['proposal_text']})
        # Remove the old field
        doc.reference.update({'proposal': __import__('google.cloud.firestore').cloud.firestore.DELETE_FIELD})
        print(f"Fixed bid {doc.id}")

print("Fixed all bids!")
