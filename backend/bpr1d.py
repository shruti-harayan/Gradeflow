# -------------------------------
# Genesis Block Creation
# -------------------------------
genesis_block = {
    'previous_hash': '',
    'index': 0,
    'transactions': [],
    'nonce': 23
}

blockchain = [genesis_block]   # Main blockchain list
open_transactions = []         # List to store open transactions


# -------------------------------
# Function to get the last block
# -------------------------------
def get_last_value():
    if len(blockchain) > 0:
        return blockchain[-1]
    return None


# -------------------------------
# Function to add a transaction
# -------------------------------
def add_value(recipient, sender, amount=1.0):
    transaction = {
        'sender': sender,
        'recipient': recipient,
        'amount': amount
    }

    open_transactions.append(transaction)


# -------------------------------
# Function to get transaction details
# -------------------------------
def get_transaction_value():
    tx_sender = input("Enter the sender: ")
    tx_recipient = input("Enter the recipient of the transaction: ")
    tx_amount = float(input("Enter the transaction amount: "))
    return tx_sender, tx_recipient, tx_amount


# -------------------------------
# Function to get user's choice
# -------------------------------
def get_user_choice():
    user_input = input("\nPlease give your choice: ")
    return user_input


# -------------------------------
# Function to mine a block
# -------------------------------
def mine_block():
    last_block = get_last_value()
    hashed_block = str(last_block)  # Temporary simple hashing for beginners

    block = {
        'previous_hash': hashed_block,
        'index': len(blockchain),
        'transactions': open_transactions.copy()
    }

    blockchain.append(block)
    open_transactions.clear()


# -------------------------------
# Function to print the blockchain
# -------------------------------
def print_blockchain():
    print("\n====== BLOCKCHAIN ======")
    for block in blockchain:
        print("\nHere is your block:")
        print(block)
    print("========================\n")


# -------------------------------
# Main Program Loop
# -------------------------------
while True:
    print("Please choose:")
    print("1: Add a new transaction")
    print("2: Mine a block")
    print("3: Print the blockchain")
    print("q: Quit the program")

    user_choice = get_user_choice()

    if user_choice == '1':
        sender, recipient, amount = get_transaction_value()
        add_value(recipient, sender, amount)
    elif user_choice == '2':
        mine_block()
        print("Block mined successfully!")
    elif user_choice == '3':
        print_blockchain()
    elif user_choice == 'q':
        print("Exiting program...")
        break
    else:
        print("Invalid choice! Please try again.")
