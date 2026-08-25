from fpdf import FPDF
from datetime import datetime
import os

GEMINI_API_KEY=""
GEMINI_MODEL="gemini-3.5-flash-lite"
NAME = "Ralfazza Rajariandhana"
DATE = datetime.now().strftime("%B %d, %Y")

PROMPT_HEADER_PATH = "prompt_header.md"
RESUME_PATH = "../resume/resume.json"
JOB_DESCRIPTION_PATH = "job_description.md"
PARAGRAPH_REFERENCE_PATH = "paragraph_reference.md"
REQUEST = ""

COVER_LETTER_BUILD_PATH = "./cover_letter_builds"

COMPANY = input("Company: ").strip()
print("Position:")
print("[1] Software Engineer (or leave empty)")
print("[2] Graduate Software Engineer")
print("[3] Software Developer")
print("[4] Graduate Software Developer")
print("[5] Game Developer")
POSITION = input("Position : ").strip()

if POSITION == "1" or POSITION == "":
    POSITION = "Software Engineer"
elif POSITION == "2":
    POSITION = "Graduate Software Engineer"
elif POSITION == "3":
    POSITION = "Software Developer"
elif POSITION == "4":
    POSITION = "Graduate Software Developer"
elif POSITION == "5":
    POSITION = "Game Developer"

# print(f"com: {company}, pos: {position}")

pdf = FPDF(
    orientation="P",
    unit="mm",
    format="A4"
)

margin_cm = 12.7 # (0.5 inches)
pdf.set_margins(left=margin_cm, top=margin_cm, right=margin_cm)
pdf.set_auto_page_break(auto=True, margin=margin_cm)
pdf.add_page()
pdf.set_font("Helvetica", size=12)
LINE_HEIGHT = 6

with open("header.md", "r", encoding="utf-8") as file:
    header = file.read()
with open("footer.md", "r", encoding="utf-8") as file:
    footer = file.read()

with open(PROMPT_HEADER_PATH, "r", encoding="utf-8") as file:
    PROMPT_HEADER = file.read()
with open(RESUME_PATH, "r", encoding="utf-8") as file:
    RESUME = file.read()
with open(JOB_DESCRIPTION_PATH, "r", encoding="utf-8") as file:
    JOB_DESCRIPTION = file.read()
with open(PARAGRAPH_REFERENCE_PATH, "r", encoding="utf-8") as file:
    PARAGRAPH_REFERENCE = file.read()

prompt = f"""{PROMPT_HEADER}

1. My full resume in JSON
```
{RESUME}
```

2. Job description
```
{JOB_DESCRIPTION}
```

3. Cover letter template
Header
```
{header}
```

Footer
```
{footer}
```

4. Paragraphs to reference of
```
{PARAGRAPH_REFERENCE}
```

5. Request
```
{REQUEST}"""

PROMPTS_FOLDER_PATH = "prompts"
def get_next_filename():
    folder=PROMPTS_FOLDER_PATH
    date_str = datetime.now().strftime("%Y_%m_%d")

    counter = 1
    while True:
        filename = f"{date_str}_{counter:02d}{".md"}"
        filepath = os.path.join(folder, filename)

        if not os.path.exists(filepath):
            return filename, filepath

        counter += 1


filename, filepath = get_next_filename()
with open(f"{PROMPTS_FOLDER_PATH}/{filename}", "w", encoding="utf-8") as file:
    file.write(prompt)
print(f"Open Prompt: {filepath}")
# print("Go and copy the prompt!\n")

print("Prompting...")
from google import genai
client = genai.Client(api_key=GEMINI_API_KEY)
interaction = client.interactions.create(
    model=GEMINI_MODEL,
    input=prompt
)
print("Prompt finished")
PROMPTS_RESPONSE_FOLDER_PATH = "response"
with open(f"{PROMPTS_RESPONSE_FOLDER_PATH}/{filename}", "w", encoding="utf-8") as file:
	# pass
	file.write(interaction.output_text)

print(f"Write Response on: {PROMPTS_RESPONSE_FOLDER_PATH}/{filename}")
# input("[ENTER WHEN PROMPT RESPONSE IS READY]")
# with open(f"{PROMPTS_RESPONSE_FOLDER_PATH}/{filename}", "r", encoding="utf-8") as file:
#     prompt_response = file.read()

prompt_response = interaction.output_text


pdf_content = f"""{header}

{prompt_response}

{footer}"""

replacements = {
    "{NAME}": NAME,
    "{DATE}": DATE,
    "{COMPANY}": COMPANY,
    "{POSITION}": POSITION
}

def add_paragraph(text, space_after=4):
    pdf.multi_cell(
        w=0,
        h=LINE_HEIGHT,
        text=text,
        align="J"
    )
    pdf.ln(space_after)

for old, new in replacements.items():
    pdf_content = pdf_content.replace(old, new)
add_paragraph(pdf_content)
pdf_filepath = f"{COVER_LETTER_BUILD_PATH}/{filename.replace(".md", ".pdf")}"
# pdf_filename = pdf_filename[:-2]
# pdf_filename += f"{}.pdf"

pdf.output(pdf_filepath)
print(f"PDF finished: {pdf_filepath}")
