# Manifest-URL fuer Foundry VTT

Eine Foundry-Manifest-URL ist die oeffentlich erreichbare URL zur Datei `system.json`.

## Empfohlener Weg: GitHub

1. Erstelle auf GitHub ein neues Repository:

```text
hope-lies-within-2
```

2. Lade den Inhalt dieses Systemordners hoch.

Wichtig: Der Ordnerinhalt muss direkt im Repository liegen. Also `system.json`, `template.json`, `scripts/`, `styles/`, `templates/` usw. nicht nochmal in einem Unterordner verstecken.

3. Ersetze in `system.json` diese Platzhalter:

```text
DEIN-GITHUB-NAME
```

Beispiel, wenn dein GitHub-Name `dominik` waere:

```json
"url": "https://github.com/dominik/hope-lies-within-2",
"manifest": "https://raw.githubusercontent.com/dominik/hope-lies-within-2/main/system.json",
"download": "https://github.com/dominik/hope-lies-within-2/releases/download/v0.1.0/hope-lies-within-2-0.1.0.zip"
```

4. Erstelle auf GitHub ein Release mit dem Tag:

```text
v0.1.0
```

5. Lade dort die ZIP-Datei hoch:

```text
hope-lies-within-2-0.1.0.zip
```

6. In Foundry nutzt du als Manifest-URL:

```text
https://raw.githubusercontent.com/DEIN-GITHUB-NAME/hope-lies-within-2/main/system.json
```

## Was Foundry damit macht

- `manifest`: Foundry liest hier die aktuelle `system.json`.
- `download`: Foundry laedt hier die installierbare ZIP-Datei.
- `url`: Link zur Projektseite.

## Fuer lokale Tests

Fuer lokale Tests brauchst du keine Manifest-URL. Kopiere oder verlinke den Systemordner nach:

```text
~/Library/Application Support/FoundryVTT/Data/systems/hope-lies-within-2
```

Die Manifest-URL ist vor allem fuer Installation auf anderen Geraeten, Updates und spaeteres Teilen wichtig.
