"""Interactive CLI for building a resume PDF from resume.json."""

import resume_builder as builder


def select_preset(data):
    presets = builder.load_presets()

    print("\nAvailable presets:")

    for preset in presets:
        print(f"  {preset}")

    print("  CUSTOM")

    while True:
        preset = input("\nPreset: ").strip().upper()

        if preset == "CUSTOM":
            selected_projects = select_items(data.get("projects", []), "projects")
            selected_experience = select_items(data.get("experience", []), "experience")

            return selected_projects, selected_experience, "CUSTOM", data

        if preset in presets:
            # The preset drives the layout, so the flags it sets are what render.
            switched = builder.apply_preset_layout(data, preset)

            return (
                switched["projects"],
                switched["experience"],
                preset,
                switched,
            )

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


def main():
    data = builder.load_resume()

    projects, experience, resume_type, data = select_preset(data)

    latex = builder.render_latex(data, projects, experience)
    pdf_bytes = builder.compile_pdf(latex)

    pdf_path = builder.build_dir() / builder.build_filename(data, resume_type)
    pdf_path.write_bytes(pdf_bytes)

    print(f"Generated: {pdf_path}")


if __name__ == "__main__":
    main()
