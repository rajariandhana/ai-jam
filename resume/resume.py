import json
import subprocess
import tempfile
import shutil
from pathlib import Path
from datetime import date


RESUME_JSON = "resume.json"
with open(RESUME_JSON, "r", encoding="utf-8") as file:
    data = json.load(file)

name = data["profile"]["name"]
today = date.today().strftime("%Y_%m_%d")

PDF_NAME = f"resume_{name}_{today}"

PRESET_JSON = "preset.json"
with open(PRESET_JSON, "r", encoding="utf-8") as file:
    PRESETS = json.load(file)

def select_preset(data):
    print("\nAvailable presets:")

    for preset in PRESETS:
        print(f"  {preset}")

    print("  CUSTOM")

    while True:
        preset = input("\nPreset: ").strip().upper()

        if preset == "CUSTOM":
            selected_projects = select_items(
                data.get("projects", []),
                "projects"
            )

            selected_experience = select_items(
                data.get("experience", []),
                "experience"
            )

            return selected_projects, selected_experience, "CUSTOM"

        if preset in PRESETS:
            config = PRESETS[preset]

            selected_projects = [
                project
                for project in data.get("projects", [])
                if project["name"] in config["projects"]
            ]

            selected_experience = [
                job
                for job in data.get("experience", [])
                if job["position"] in config["experience"]
            ]

            return selected_projects, selected_experience, preset

        print(f"Unknown preset '{preset}'. Please try again.")

def select_items(items, item_type):
    if not items:
        return []

    print(f"\n{'=' * 50}")
    print(f"Select {item_type}")
    print(f"{'=' * 50}")
    print("Press Enter to include an item.")
    print("Type anything and press Enter to exclude it.\n")

    selected = []

    for item in items:
        if item_type == "projects":
            title = item["name"]
        else:
            title = f'{item["position"]} — {item["company"]}'

        choice = input(f"Include '{title}'? [Enter=yes]: ")

        if choice == "":
            selected.append(item)
            print("  [Y] Included\n")
        else:
            print("  [N] Skipped\n")

    return selected

def latex_escape(text):
    """Escape characters that have special meaning in LaTeX."""
    if text is None:
        return ""

    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text


def generate_coursework(coursework):
    if not coursework:
        return ""

    items = " · ".join(latex_escape(item) for item in coursework)

    return rf"""
    \resumeItem{{\textbf{{Coursework:}} {items}}}
"""


def generate_education(education):
    if not education:
        return ""

    output = []

    for edu in education:
        university = latex_escape(edu["university"])
        location = latex_escape(edu["location"])
        degree = latex_escape(edu["degree"])
        date = latex_escape(edu["date"])

        coursework = generate_coursework(edu.get("coursework", []))

        output.append(
            rf"""
\resumeSubheading
    {{{university}}}{{{location}}}
    {{{degree}}}{{{date}}}
\resumeItemListStart
{coursework}
\resumeItemListEnd
"""
        )

    return "\n".join(output)


def generate_projects(projects):
    if not projects:
        return ""

    output = []

    for project in projects:
        name = latex_escape(project["name"])
        stack = ", ".join(latex_escape(x) for x in project.get("stack", []))
        date = latex_escape(project["date"])

        descriptions = "\n".join(
            rf"    \resumeItem{{{latex_escape(description)}}}"
            for description in project.get("description", [])
        )

        output.append(
            rf"""
\resumeProjectHeading
    {{\textbf{{{name}}} $|$ \emph{{{stack}}}}}{{{date}}}
\resumeItemListStart
{descriptions}
\resumeItemListEnd
"""
        )

    return "\n".join(output)


def generate_experience(experience):
    if not experience:
        return ""

    output = []

    for job in experience:
        company = latex_escape(job["company"])
        position = latex_escape(job["position"])
        date = latex_escape(job["date"])
        location = latex_escape(job["location"])

        descriptions = "\n".join(
            rf"    \resumeItem{{{latex_escape(description)}}}"
            for description in job.get("description", [])
        )

        output.append(
            rf"""
\resumeSubheading
    {{{position}}}{{{date}}}
    {{{company}}}{{{location}}}
\resumeItemListStart
{descriptions}
\resumeItemListEnd
"""
        )

    return "\n".join(output)


def generate_skills(skills):
    if not skills:
        return ""

    output = []

    for skill in skills:
        category = latex_escape(skill["category"])
        description = latex_escape(skill["description"])

        output.append(
            rf"""
     \textbf{{{category}}}: {description} \\
"""
        )

    return "\n".join(output)

profile = data["profile"]



name = latex_escape(profile["name"])
website = latex_escape(profile["website"])
email = latex_escape(profile["email"])
linkedin = latex_escape(profile["linkedin"])
github = latex_escape(profile["github"])


website_display = website.removeprefix("https://").removeprefix("http://")
linkedin_display = linkedin.removeprefix("https://").removeprefix("http://")
github_display = github.removeprefix("https://").removeprefix("http://")



selected_projects, selected_experience, resume_type = select_preset(data)

if resume_type:
    PDF_NAME = f"{PDF_NAME}_{resume_type}"

education = generate_education(data.get("education", []))
projects = generate_projects(selected_projects)
experience = generate_experience(selected_experience)
skills = generate_skills(data.get("skills", []))


main = rf"""
\begin{{document}}

%----------HEADING----------

\begin{{center}}
    \textbf{{\Huge \scshape {name}}} \\ \vspace{{1pt}}

    \small
    \href{{{website}}}
    {{\underline{{{website_display}}}}} $|$
    \href{{mailto:{email}}}
    {{\underline{{{email}}}}} $|$
    \href{{{linkedin}}}
    {{\underline{{{linkedin_display}}}}} $|$
    \href{{{github}}}
    {{\underline{{{github_display}}}}}
\end{{center}}


%-----------EDUCATION-----------
\section{{Education}}
\resumeSubHeadingListStart

{education}

\resumeSubHeadingListEnd


%-----------PROJECTS-----------
\section{{Projects}}
\resumeSubHeadingListStart

{projects}

\resumeSubHeadingListEnd


%-----------EXPERIENCE-----------
\section{{Experience}}
\resumeSubHeadingListStart

{experience}

\resumeSubHeadingListEnd


%-----------PROGRAMMING SKILLS-----------
\section{{Skills}}
\begin{{itemize}}[leftmargin=0.15in, label={{}}]
    \small{{\item{{
{skills}
    }}}}
\end{{itemize}}

\end{{document}}
"""


with open("doc_settings", "r", encoding="utf-8") as file:
    doc_settings = file.read()


latex = doc_settings + "\n" + main


build_dir = Path("resume_builds")
build_dir.mkdir(exist_ok=True)

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)

    tex_file = tmp / "doc.tex"
    tex_file.write_text(latex, encoding="utf-8")

    subprocess.run(
        [
            "pdflatex",
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-output-directory",
            str(tmp),
            str(tex_file),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    shutil.copy2(
        tmp / "doc.pdf",
        build_dir / f"{PDF_NAME}.pdf",
    )


print(f"Generated: {build_dir}/{PDF_NAME}.pdf")