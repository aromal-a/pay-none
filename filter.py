"""
OS Filter Module
Filters operating system calls and requests based on a whitelist/blacklist approach.
Implements app-wise filtering logic with comprehensive logging and monitoring.
"""

import logging
from typing import List, Set, Dict, Any, Optional
from enum import Enum
from dataclasses import dataclass
from datetime import datetime


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FilterMode(Enum):
    """Filter operation modes"""
    WHITELIST = "whitelist"  # Only allow listed OS
    BLACKLIST = "blacklist"  # Block listed OS


class OSPlatform(Enum):
    """Operating System Platforms"""
    WINDOWS = "windows"
    LINUX = "linux"
    MACOS = "macos"
    IOS = "ios"
    ANDROID = "android"
    UBUNTU = "ubuntu"
    DEBIAN = "debian"
    CENTOS = "centos"
    FEDORA = "fedora"
    OTHER = "other"


@dataclass
class OSCall:
    """Represents an OS call/request"""
    app_name: str
    os_name: str
    timestamp: datetime
    call_type: str
    metadata: Dict[str, Any]


class OSFilter:
    """
    Operating System Filter for app-wise OS call filtering.
    
    Features:
    - Whitelist/Blacklist filtering
    - Per-app filtering rules
    - Call history and logging
    - Real-time filtering with statistics
    """
    
    def __init__(self, mode: FilterMode = FilterMode.WHITELIST):
        """
        Initialize OS Filter
        
        Args:
            mode: FilterMode.WHITELIST or FilterMode.BLACKLIST
        """
        self.mode = mode
        self.os_list: Set[str] = set()  # ADD YOUR OS LIST HERE
        self.app_rules: Dict[str, Set[str]] = {}  # Per-app OS rules
        self.call_history: List[OSCall] = []
        self.statistics: Dict[str, Dict[str, int]] = {}
        
        logger.info(f"OS Filter initialized with mode: {mode.value}")
    
    def add_os(self, os_name: str) -> None:
        """
        Add an operating system to the filter list
        
        Args:
            os_name: Name of the operating system
        """
        normalized_os = os_name.lower().strip()
        self.os_list.add(normalized_os)
        logger.debug(f"OS added to filter list: {normalized_os}")
    
    def add_os_batch(self, os_names: List[str]) -> None:
        """
        Add multiple operating systems at once
        
        Args:
            os_names: List of operating system names
        """
        for os_name in os_names:
            self.add_os(os_name)
        logger.info(f"Batch added {len(os_names)} OS entries")
    
    def set_os_list(self, os_names: List[str]) -> None:
        """
        Set the complete OS filter list (replaces existing)
        
        Args:
            os_names: Complete list of OS names to filter
        """
        self.os_list = set(name.lower().strip() for name in os_names)
        logger.info(f"OS filter list updated with {len(self.os_list)} entries: {self.os_list}")
    
    def add_app_rule(self, app_name: str, allowed_os: List[str]) -> None:
        """
        Add app-specific OS filtering rules
        
        Args:
            app_name: Application name
            allowed_os: List of allowed OS for this app
        """
        self.app_rules[app_name.lower()] = set(
            os.lower().strip() for os in allowed_os
        )
        logger.info(f"App rule added for '{app_name}': {self.app_rules[app_name.lower()]}")
    
    def should_allow_call(self, app_name: str, os_name: str) -> bool:
        """
        Determine if an OS call should be allowed
        
        Args:
            app_name: Name of the application making the call
            os_name: Target operating system
            
        Returns:
            bool: True if call should be allowed, False otherwise
        """
        normalized_app = app_name.lower().strip()
        normalized_os = os_name.lower().strip()
        
        # Check app-specific rules first
        if normalized_app in self.app_rules:
            app_os_set = self.app_rules[normalized_app]
            allowed = normalized_os in app_os_set
            logger.debug(f"App-specific rule for '{normalized_app}': OS '{normalized_os}' -> {allowed}")
            return allowed
        
        # Check global filter list
        if self.mode == FilterMode.WHITELIST:
            allowed = normalized_os in self.os_list
        else:  # BLACKLIST
            allowed = normalized_os not in self.os_list
        
        logger.debug(f"Global filter ({self.mode.value}): OS '{normalized_os}' -> {allowed}")
        return allowed
    
    def filter_call(self, app_name: str, os_name: str, 
                   call_type: str = "generic", metadata: Dict[str, Any] = None) -> bool:
        """
        Filter an OS call and log the result
        
        Args:
            app_name: Application name
            os_name: Target OS
            call_type: Type of call (e.g., 'system_call', 'api_request', 'permission_check')
            metadata: Additional metadata about the call
            
        Returns:
            bool: True if call is allowed, False if blocked
        """
        if metadata is None:
            metadata = {}
        
        allowed = self.should_allow_call(app_name, os_name)
        
        # Create call record
        call = OSCall(
            app_name=app_name,
            os_name=os_name,
            timestamp=datetime.now(),
            call_type=call_type,
            metadata=metadata
        )
        
        self.call_history.append(call)
        self._update_statistics(app_name, os_name, allowed)
        
        status = "ALLOWED" if allowed else "BLOCKED"
        logger.info(
            f"{status}: App '{app_name}' -> OS '{os_name}' | Type: {call_type}"
        )
        
        return allowed
    
    def _update_statistics(self, app_name: str, os_name: str, allowed: bool) -> None:
        """Update filtering statistics"""
        app_key = app_name.lower()
        
        if app_key not in self.statistics:
            self.statistics[app_key] = {
                "total_calls": 0,
                "allowed": 0,
                "blocked": 0,
                "os_breakdown": {}
            }
        
        self.statistics[app_key]["total_calls"] += 1
        if allowed:
            self.statistics[app_key]["allowed"] += 1
        else:
            self.statistics[app_key]["blocked"] += 1
        
        os_key = os_name.lower()
        if os_key not in self.statistics[app_key]["os_breakdown"]:
            self.statistics[app_key]["os_breakdown"][os_key] = {"allowed": 0, "blocked": 0}
        
        if allowed:
            self.statistics[app_key]["os_breakdown"][os_key]["allowed"] += 1
        else:
            self.statistics[app_key]["os_breakdown"][os_key]["blocked"] += 1
    
    def get_statistics(self, app_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get filtering statistics
        
        Args:
            app_name: Specific app to get stats for (None for all)
            
        Returns:
            Dictionary containing statistics
        """
        if app_name:
            return self.statistics.get(app_name.lower(), {})
        return self.statistics
    
    def print_report(self) -> None:
        """Print filtering statistics report"""
        print("\n" + "="*60)
        print("OS FILTER STATISTICS REPORT")
        print("="*60)
        print(f"Filter Mode: {self.mode.value}")
        print(f"OS List: {self.os_list}")
        print(f"Total Calls Processed: {sum(s['total_calls'] for s in self.statistics.values())}")
        print("\nPer-App Breakdown:")
        print("-"*60)
        
        for app_name, stats in self.statistics.items():
            print(f"\nApp: {app_name}")
            print(f"  Total Calls: {stats['total_calls']}")
            print(f"  Allowed: {stats['allowed']}")
            print(f"  Blocked: {stats['blocked']}")
            print(f"  Allow Rate: {(stats['allowed']/stats['total_calls']*100):.1f}%")
            print(f"  OS Breakdown:")
            for os_name, breakdown in stats['os_breakdown'].items():
                print(f"    {os_name}: Allowed={breakdown['allowed']}, Blocked={breakdown['blocked']}")
        
        print("\n" + "="*60 + "\n")


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

if __name__ == "__main__":
    # Initialize filter in WHITELIST mode
    filter_obj = OSFilter(mode=FilterMode.WHITELIST)
    
    # TODO: Add your OS list here
    # Example:
    # os_names = ["windows", "linux", "macos"]
    # filter_obj.set_os_list(os_names)
    
    os_names = ["windows", "linux", "macos"]  # REPLACE WITH YOUR LIST
    filter_obj.set_os_list(os_names)
    
    # Add app-specific rules (optional)
    filter_obj.add_app_rule("chrome", ["windows", "linux", "macos", "ios", "android"])
    filter_obj.add_app_rule("safari", ["macos", "ios"])
    
    # Test filtering
    test_calls = [
        ("chrome", "windows", "system_call"),
        ("firefox", "linux", "api_request"),
        ("safari", "android", "permission_check"),
        ("edge", "macos", "system_call"),
    ]
    
    print("Running filter tests...")
    for app, os, call_type in test_calls:
        filter_obj.filter_call(app, os, call_type)
    
    # Print report
    filter_obj.print_report()
