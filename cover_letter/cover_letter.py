"""Interactive CLI over generate.generate_cover_letter, which writes the body
with Claude, saves the letter as JSON and builds the PDF."""

from pathlib import Path

from generate import generate_cover_letter

CURRENT_DIR = Path(__file__).resolve().parent
JOB_DESCRIPTION_PATH = CURRENT_DIR / "job_description.md"

company = input("Company: ").strip()
print("Position:")
print("[1] Software Engineer (or leave empty)")
print("[2] Graduate Software Engineer")
print("[3] Software Developer")
print("[4] Graduate Software Developer")
print("[5] Game Developer")
position = input("Position : ").strip()

with open(JOB_DESCRIPTION_PATH, "r", encoding="utf-8") as file:
    job_description = file.read()

print("Prompting Claude...")
letter = generate_cover_letter(company, position, job_description)
print(f"Letter saved: {letter['id']}")
print(f"PDF finished: {letter['pdf_path']}")
