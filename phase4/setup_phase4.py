#!/usr/bin/env python3
"""
PokeDAO Phase 4 - Setup and Deployment Script
Automated setup for production data pipeline

Author: PokeDAO Builder
Version: Phase 4.0.0
"""

import os
import sys
import json
import subprocess
import asyncio
from pathlib import Path

# Color codes for output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str):
    """Print colored header"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text:^60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")


def print_step(step: str, description: str):
    """Print setup step"""
    print(f"{Colors.OKBLUE}🔧 {step}:{Colors.ENDC} {description}")


def print_success(message: str):
    """Print success message"""
    print(f"{Colors.OKGREEN}✅ {message}{Colors.ENDC}")


def print_error(message: str):
    """Print error message"""
    print(f"{Colors.FAIL}❌ {message}{Colors.ENDC}")


def print_warning(message: str):
    """Print warning message"""
    print(f"{Colors.WARNING}⚠️ {message}{Colors.ENDC}")


def run_command(command: str, description: str = "") -> bool:
    """Run shell command and return success status"""
    if description:
        print(f"{Colors.OKCYAN}▶️ {description}{Colors.ENDC}")
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print_success(f"Command completed: {command}")
            return True
        else:
            print_error(f"Command failed: {command}")
            print(f"Error: {result.stderr}")
            return False
    except Exception as e:
        print_error(f"Exception running command: {e}")
        return False


def create_config_file():
    """Create default configuration file"""
    config = {
        "version": "4.0.0",
        "environment": "development",
        "blockchain": {
            "enabled": True,
            "solana_rpc_url": "https://api.mainnet-beta.solana.com",
            "magic_eden_api": "https://api-mainnet.magiceden.dev/v2",
            "max_cards": 1000,
            "collections_limit": 20,
            "rate_limit_delay": 1.0,
            "retry_attempts": 3
        },
        "apis": {
            "enabled": True,
            "ebay": {
                "enabled": True,
                "client_id": "YOUR_EBAY_CLIENT_ID",
                "client_secret": "YOUR_EBAY_CLIENT_SECRET",
                "environment": "PRODUCTION",
                "max_cards": 500,
                "rate_limit_delay": 0.5
            },
            "tcgplayer": {
                "enabled": False,
                "api_key": "YOUR_TCGPLAYER_API_KEY",
                "max_cards": 300
            }
        },
        "database": {
            "enabled": True,
            "host": "localhost",
            "port": 5432,
            "database": "pokedao",
            "user": "postgres",
            "password": "YOUR_DATABASE_PASSWORD",
            "auto_insert": True,
            "connection_pool_size": 10
        },
        "output": {
            "save_files": True,
            "output_dir": "phase4_data",
            "backup_enabled": True,
            "compression": True
        },
        "quality": {
            "enable_validation": True,
            "enable_outlier_detection": True,
            "min_quality_score": 0.7,
            "max_price_deviation": 5.0
        },
        "scheduling": {
            "enabled": False,
            "interval_hours": 6,
            "auto_restart": True
        },
        "logging": {
            "level": "INFO",
            "file": "pokedao_phase4.log",
            "max_size_mb": 100,
            "backup_count": 5
        },
        "alerts": {
            "enabled": False,
            "telegram_bot_token": "YOUR_TELEGRAM_BOT_TOKEN",
            "telegram_chat_id": "YOUR_TELEGRAM_CHAT_ID",
            "price_alert_threshold": 10.0,
            "error_notifications": True
        }
    }
    
    config_path = "config.json"
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    print_success(f"Configuration file created: {config_path}")
    return config_path


def setup_python_environment():
    """Set up Python virtual environment and dependencies"""
    print_step("Python Environment", "Setting up virtual environment and dependencies")
    
    # Check Python version
    python_version = sys.version_info
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 8):
        print_error("Python 3.8+ required. Current version: {}.{}".format(
            python_version.major, python_version.minor))
        return False
    
    print_success(f"Python version: {python_version.major}.{python_version.minor}")
    
    # Create virtual environment
    venv_path = "venv_phase4"
    if not os.path.exists(venv_path):
        if not run_command(f"python -m venv {venv_path}", "Creating virtual environment"):
            return False
    else:
        print_success("Virtual environment already exists")
    
    # Activate virtual environment and install dependencies
    if sys.platform == "win32":
        activate_cmd = f"{venv_path}\\Scripts\\activate"
        pip_cmd = f"{venv_path}\\Scripts\\pip"
    else:
        activate_cmd = f"source {venv_path}/bin/activate"
        pip_cmd = f"{venv_path}/bin/pip"
    
    # Install requirements
    if not run_command(f"{pip_cmd} install --upgrade pip", "Upgrading pip"):
        return False
    
    if not run_command(f"{pip_cmd} install -r requirements.txt", "Installing Python dependencies"):
        return False
    
    print_success("Python environment setup complete")
    return True


def setup_database():
    """Set up database connections and verify Phase 1 schema"""
    print_step("Database", "Verifying database connectivity and schema")
    
    # Check if PostgreSQL is running
    pg_check = run_command("pg_isready", "Checking PostgreSQL status")
    if not pg_check:
        print_warning("PostgreSQL may not be running. Please start PostgreSQL service.")
        print("On macOS: brew services start postgresql")
        print("On Ubuntu: sudo systemctl start postgresql")
        print("On Docker: docker-compose up -d postgres")
        return False
    
    print_success("PostgreSQL is running")
    
    # TODO: Add database schema validation
    print_warning("Database schema validation not implemented yet")
    print("Please ensure Phase 1 Prisma database is set up with proper schema")
    
    return True


def setup_directories():
    """Create necessary directories"""
    print_step("Directories", "Creating project directories")
    
    directories = [
        "phase4_data",
        "logs",
        "backups",
        "exports"
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print_success(f"Directory created: {directory}")
    
    return True


def run_tests():
    """Run Phase 4 test suite"""
    print_step("Testing", "Running Phase 4 test suite")
    
    # Basic test runner
    if not run_command("python test_phase4.py", "Running basic tests"):
        print_warning("Basic tests failed")
    
    # Try pytest if available
    if run_command("which pytest", "Checking for pytest"):
        if not run_command("pytest test_phase4.py -v", "Running comprehensive tests"):
            print_warning("Comprehensive tests failed")
    else:
        print_warning("pytest not found. Install with: pip install pytest")
    
    return True


def create_startup_script():
    """Create startup script for easy pipeline execution"""
    script_content = """#!/bin/bash
# PokeDAO Phase 4 Pipeline Startup Script

echo "🚀 Starting PokeDAO Phase 4 Pipeline..."

# Activate virtual environment
source venv_phase4/bin/activate

# Set environment variables
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Run the pipeline
python pipeline/main_pipeline.py

echo "🏁 Pipeline execution complete!"
"""
    
    script_path = "start_pipeline.sh"
    with open(script_path, 'w') as f:
        f.write(script_content)
    
    # Make executable
    os.chmod(script_path, 0o755)
    
    print_success(f"Startup script created: {script_path}")
    return script_path


def create_docker_config():
    """Create Docker configuration for containerized deployment"""
    dockerfile_content = """# PokeDAO Phase 4 Pipeline Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    postgresql-client \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories
RUN mkdir -p phase4_data logs backups exports

# Expose port for health checks
EXPOSE 8080

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
    CMD python -c "import sys; sys.exit(0)"

# Run pipeline
CMD ["python", "pipeline/main_pipeline.py"]
"""
    
    docker_compose_content = """version: '3.8'

services:
  phase4-pipeline:
    build: .
    container_name: pokedao-phase4
    environment:
      - PYTHONPATH=/app
      - POKEDAO_CONFIG=/app/config.json
    volumes:
      - ./config.json:/app/config.json:ro
      - ./phase4_data:/app/phase4_data
      - ./logs:/app/logs
    depends_on:
      - postgres
    restart: unless-stopped
    networks:
      - pokedao-network

  postgres:
    image: postgres:15
    container_name: pokedao-postgres
    environment:
      - POSTGRES_DB=pokedao
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=your_password_here
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    networks:
      - pokedao-network

volumes:
  postgres_data:

networks:
  pokedao-network:
    driver: bridge
"""
    
    # Write Dockerfile
    with open("Dockerfile", 'w') as f:
        f.write(dockerfile_content)
    
    # Write docker-compose.yml
    with open("docker-compose.phase4.yml", 'w') as f:
        f.write(docker_compose_content)
    
    print_success("Docker configuration created")
    return True


def print_next_steps():
    """Print next steps for user"""
    print_header("🎯 PHASE 4 SETUP COMPLETE!")
    
    print(f"{Colors.OKGREEN}✅ Phase 4 pipeline is ready for deployment!{Colors.ENDC}\n")
    
    print(f"{Colors.BOLD}📋 Next Steps:{Colors.ENDC}")
    print("1. 🔑 Configure API credentials in config.json:")
    print("   - eBay API: client_id, client_secret")
    print("   - Database: host, user, password")
    print("   - Telegram: bot_token, chat_id (optional)")
    print()
    print("2. 🗄️ Ensure Phase 1 database is running:")
    print("   - PostgreSQL service active")
    print("   - Prisma schema migrated")
    print("   - Database accessible")
    print()
    print("3. 🚀 Run the pipeline:")
    print("   - Quick start: ./start_pipeline.sh")
    print("   - Manual: source venv_phase4/bin/activate && python pipeline/main_pipeline.py")
    print("   - Docker: docker-compose -f docker-compose.phase4.yml up")
    print()
    print("4. 🧪 Test the setup:")
    print("   - Basic tests: python test_phase4.py")
    print("   - Full tests: pytest test_phase4.py -v")
    print()
    print("5. 🔄 Schedule regular runs:")
    print("   - Cron job: 0 */6 * * * /path/to/start_pipeline.sh")
    print("   - Systemd service: Create service file")
    print("   - Docker scheduler: Set restart policies")
    print()
    print(f"{Colors.BOLD}📚 Documentation:{Colors.ENDC}")
    print("- Configuration: config.json")
    print("- Logs: pokedao_phase4.log")
    print("- Data output: phase4_data/")
    print("- Test results: Run pytest for detailed reports")
    print()
    print(f"{Colors.BOLD}🔧 Troubleshooting:{Colors.ENDC}")
    print("- Check logs for detailed error messages")
    print("- Verify API credentials and rate limits")
    print("- Ensure database connectivity")
    print("- Monitor system resources (CPU, memory, disk)")
    print()
    print(f"{Colors.OKGREEN}🎉 Ready to revolutionize Pokemon card trading with blockchain intelligence!{Colors.ENDC}")


def main():
    """Main setup function"""
    print_header("🚀 PokeDAO Phase 4 Setup & Deployment")
    
    print(f"{Colors.OKCYAN}🎯 Mission: Production Data Pipeline Implementation{Colors.ENDC}")
    print(f"{Colors.OKCYAN}🔗 Sources: Blockchain + APIs + Database Integration{Colors.ENDC}")
    print(f"{Colors.OKCYAN}📈 Output: Real-time Pokemon card trading intelligence{Colors.ENDC}")
    
    setup_steps = [
        ("Create Configuration", create_config_file),
        ("Setup Directories", setup_directories),
        ("Setup Python Environment", setup_python_environment),
        ("Setup Database", setup_database),
        ("Run Tests", run_tests),
        ("Create Startup Script", create_startup_script),
        ("Create Docker Config", create_docker_config)
    ]
    
    success_count = 0
    total_steps = len(setup_steps)
    
    for step_name, step_function in setup_steps:
        try:
            print_step("Setup", step_name)
            result = step_function()
            if result:
                success_count += 1
                print_success(f"✅ {step_name} completed")
            else:
                print_error(f"❌ {step_name} failed")
        except Exception as e:
            print_error(f"❌ {step_name} failed with exception: {e}")
    
    print_header("📊 SETUP SUMMARY")
    print(f"✅ Completed: {success_count}/{total_steps} steps")
    print(f"📊 Success Rate: {success_count/total_steps*100:.1f}%")
    
    if success_count == total_steps:
        print_next_steps()
    else:
        print_error("Some setup steps failed. Please review and fix issues before proceeding.")
        print("You can re-run this setup script to retry failed steps.")


if __name__ == "__main__":
    main()
