import tkinter as tk
from tkinter import ttk, messagebox
import webbrowser

def open_studio():
    webbrowser.open("http://127.0.0.1:5000")

root = tk.Tk()
root.title("Racksson Divine Cosmic Music Studio")
root.geometry("480x320")
root.configure(bg="#FFD700")  # Golden Spirit background

label = ttk.Label(root, text="🎶 Racksson Divine Music Studio 🎶", font=("Helvetica", 16))
label.pack(pady=20)

btn_open = ttk.Button(root, text="Open Studio", command=open_studio)
btn_open.pack(pady=10)

btn_exit = ttk.Button(root, text="Exit", command=root.destroy)
btn_exit.pack(pady=10)

root.mainloop()