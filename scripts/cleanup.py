#!/usr/bin/env python3
"""
Microdiag Sentinel - Script de Nettoyage Système
================================================
Supprime les fichiers temporaires, cache, et libère de l'espace disque.

Usage: python cleanup.py [--dry-run] [--verbose]
"""

import os
import sys

# Fix encodage Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import shutil
import tempfile
import argparse
import json
from pathlib import Path
from datetime import datetime, timedelta


class SystemCleaner:
    """Nettoyeur système cross-platform."""

    def __init__(self, dry_run=False, verbose=False):
        self.dry_run = dry_run
        self.verbose = verbose
        self.stats = {
            "files_deleted": 0,
            "dirs_deleted": 0,
            "bytes_freed": 0,
            "errors": []
        }

    def log(self, message, level="info"):
        """Log avec niveau."""
        if self.verbose or level in ["error", "warning"]:
            prefix = {"info": "ℹ️", "success": "✅", "warning": "⚠️", "error": "❌"}.get(level, "")
            print(f"{prefix} {message}")

    def get_size(self, path):
        """Taille d'un fichier ou dossier."""
        if os.path.isfile(path):
            return os.path.getsize(path)
        total = 0
        try:
            for dirpath, _, filenames in os.walk(path):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if os.path.exists(fp):
                        total += os.path.getsize(fp)
        except (PermissionError, OSError):
            pass
        return total

    def delete_path(self, path, description=""):
        """Supprime un fichier ou dossier."""
        if not os.path.exists(path):
            return 0

        size = self.get_size(path)

        if self.dry_run:
            self.log(f"[DRY-RUN] Supprimerais: {path} ({self.format_size(size)})")
            return size

        try:
            if os.path.isfile(path):
                os.remove(path)
                self.stats["files_deleted"] += 1
            else:
                shutil.rmtree(path, ignore_errors=True)
                self.stats["dirs_deleted"] += 1

            self.stats["bytes_freed"] += size
            self.log(f"Supprimé: {path} ({self.format_size(size)})", "success")
            return size
        except (PermissionError, OSError) as e:
            self.stats["errors"].append(str(e))
            self.log(f"Erreur: {path} - {e}", "error")
            return 0

    def format_size(self, bytes_size):
        """Formate la taille en unités lisibles."""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_size < 1024:
                return f"{bytes_size:.2f} {unit}"
            bytes_size /= 1024
        return f"{bytes_size:.2f} TB"

    def clean_temp_folders(self):
        """Nettoie les dossiers temporaires."""
        self.log("Nettoyage des dossiers temporaires...", "info")

        temp_paths = [
            tempfile.gettempdir(),
            os.path.expandvars(r"%TEMP%"),
            os.path.expandvars(r"%TMP%"),
            os.path.expanduser("~\\AppData\\Local\\Temp"),
        ]

        for temp_path in set(temp_paths):
            if os.path.exists(temp_path):
                try:
                    for item in os.listdir(temp_path):
                        item_path = os.path.join(temp_path, item)
                        # Ne pas supprimer les fichiers récents (< 1h)
                        try:
                            mtime = os.path.getmtime(item_path)
                            if datetime.now() - datetime.fromtimestamp(mtime) < timedelta(hours=1):
                                continue
                        except OSError:
                            continue
                        self.delete_path(item_path, "temp")
                except PermissionError:
                    pass

    def clean_windows_cache(self):
        """Nettoie les caches Windows."""
        self.log("Nettoyage des caches Windows...", "info")

        cache_paths = [
            os.path.expanduser("~\\AppData\\Local\\Microsoft\\Windows\\INetCache"),
            os.path.expanduser("~\\AppData\\Local\\Microsoft\\Windows\\Explorer\\thumbcache_*.db"),
            os.path.expandvars(r"%WINDIR%\Prefetch"),
            os.path.expandvars(r"%WINDIR%\SoftwareDistribution\Download"),
        ]

        for cache_path in cache_paths:
            if "*" in cache_path:
                # Glob pattern
                from glob import glob
                for matched in glob(cache_path):
                    self.delete_path(matched, "cache")
            elif os.path.exists(cache_path):
                self.delete_path(cache_path, "cache")

    def clean_browser_cache(self):
        """Nettoie les caches des navigateurs."""
        self.log("Nettoyage des caches navigateurs...", "info")

        browsers = {
            "Chrome": "~\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache",
            "Firefox": "~\\AppData\\Local\\Mozilla\\Firefox\\Profiles\\*\\cache2",
            "Edge": "~\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache",
            "Brave": "~\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Default\\Cache",
        }

        for browser, path in browsers.items():
            expanded = os.path.expanduser(path)
            if "*" in expanded:
                from glob import glob
                for matched in glob(expanded):
                    self.log(f"Nettoyage cache {browser}...", "info")
                    self.delete_path(matched, f"cache_{browser.lower()}")
            elif os.path.exists(expanded):
                self.log(f"Nettoyage cache {browser}...", "info")
                self.delete_path(expanded, f"cache_{browser.lower()}")

    def clean_recycle_bin(self):
        """Vide la corbeille (Windows)."""
        self.log("Vidage de la corbeille...", "info")

        if self.dry_run:
            self.log("[DRY-RUN] Viderait la corbeille")
            return

        try:
            import ctypes
            SHERB_NOCONFIRMATION = 0x00000001
            SHERB_NOPROGRESSUI = 0x00000002
            SHERB_NOSOUND = 0x00000004
            ctypes.windll.shell32.SHEmptyRecycleBinW(
                None, None,
                SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND
            )
            self.log("Corbeille vidée", "success")
        except Exception as e:
            self.log(f"Impossible de vider la corbeille: {e}", "warning")

    def clean_logs(self):
        """Nettoie les anciens fichiers log."""
        self.log("Nettoyage des anciens logs...", "info")

        log_paths = [
            os.path.expandvars(r"%WINDIR%\Logs"),
            os.path.expanduser("~\\AppData\\Local\\Temp\\*.log"),
        ]

        # Supprimer les logs > 7 jours
        cutoff = datetime.now() - timedelta(days=7)

        for log_path in log_paths:
            if "*" in log_path:
                from glob import glob
                for matched in glob(log_path):
                    try:
                        mtime = datetime.fromtimestamp(os.path.getmtime(matched))
                        if mtime < cutoff:
                            self.delete_path(matched, "log")
                    except OSError:
                        pass

    def run(self):
        """Exécute le nettoyage complet."""
        print("=" * 50)
        print("🧹 MICRODIAG SENTINEL - NETTOYAGE SYSTÈME")
        print("=" * 50)

        if self.dry_run:
            print("⚠️  Mode simulation (dry-run) - rien ne sera supprimé\n")

        self.clean_temp_folders()
        self.clean_windows_cache()
        self.clean_browser_cache()
        self.clean_recycle_bin()
        self.clean_logs()

        print("\n" + "=" * 50)
        print("📊 RÉSULTAT DU NETTOYAGE")
        print("=" * 50)
        print(f"   Fichiers supprimés : {self.stats['files_deleted']}")
        print(f"   Dossiers supprimés : {self.stats['dirs_deleted']}")
        print(f"   Espace libéré      : {self.format_size(self.stats['bytes_freed'])}")

        if self.stats["errors"]:
            print(f"   Erreurs            : {len(self.stats['errors'])}")

        print("=" * 50)

        # Retourner le résultat en JSON pour l'agent
        return json.dumps({
            "success": True,
            "files_deleted": self.stats["files_deleted"],
            "dirs_deleted": self.stats["dirs_deleted"],
            "bytes_freed": self.stats["bytes_freed"],
            "bytes_freed_formatted": self.format_size(self.stats["bytes_freed"]),
            "errors_count": len(self.stats["errors"])
        })


def main():
    parser = argparse.ArgumentParser(description="Microdiag - Nettoyage système")
    parser.add_argument("--dry-run", action="store_true", help="Simulation sans suppression")
    parser.add_argument("--verbose", "-v", action="store_true", help="Affichage détaillé")
    args = parser.parse_args()

    cleaner = SystemCleaner(dry_run=args.dry_run, verbose=args.verbose)
    result = cleaner.run()
    print(result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
