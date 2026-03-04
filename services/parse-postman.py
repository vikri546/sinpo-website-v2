import json
import os
from tabulate import tabulate

def extract_requests(items, parent_folder=""):
    """Recursively extract requests from Postman collection items."""
    endpoints = []
    for item in items:
        if "item" in item:  # Folder
            folder_name = f"{parent_folder}/{item['name']}" if parent_folder else item['name']
            endpoints.extend(extract_requests(item["item"], folder_name))
        else:  # Request
            try:
                name = item.get("name", "Unnamed Request")
                method = item["request"]["method"]
                url_data = item["request"]["url"]

                # Handle raw or structured URL
                if isinstance(url_data, dict):
                    if "raw" in url_data:
                        url = url_data["raw"]
                    else:
                        url = "/".join(url_data.get("host", []) + url_data.get("path", []))
                else:
                    url = str(url_data)

                endpoints.append([parent_folder, name, method, url])
            except KeyError as e:
                print(f"Skipping malformed request: {e}")
    return endpoints

def main():
    file_path = "SINPO FRONTEND API.postman_collection.json"

    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    items = data.get("item", [])
    endpoints = extract_requests(items)

    if endpoints:
        print(tabulate(endpoints, headers=["Folder", "Request Name", "Method", "URL"], tablefmt="grid"))
    else:
        print("No endpoints found in the collection.")

if __name__ == "__main__":
    main()
