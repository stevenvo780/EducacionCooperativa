#!/bin/bash
set -e

echo "🏗️  Building RPM for Education Cooperative Agent..."

# Ensure we are in agent dir
cd "$(dirname "$0")/.."
AGENT_ROOT=$(pwd)

# 1. Build & Package
echo "📦 Compiling and Packaging..."
npm run build
npm run package

# 2. Setup RPM Build Dir
RPM_BUILD_DIR="rpm-build"
rm -rf $RPM_BUILD_DIR
mkdir -p $RPM_BUILD_DIR/{BUILD,RPMS,SOURCES,SPECS,SRPMS}

# 3. Generate SPEC File
SPEC_FILE="$RPM_BUILD_DIR/SPECS/edu-agent.spec"

cat > $SPEC_FILE << EOL
Name:       edu-agent
Version:    1.0.0
Release:    1%{?dist}
Summary:    Local Agent for Educacion Cooperativa
License:    Proprietary
URL:        https://educacioncooperativa.com
BuildArch:  x86_64

%description
This agent runs a Dockerized worker that connects your
local environment to the Education Cooperative cloud platform.

%prep
# No preparation needed

%build
# No build steps needed

%install
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/lib/edu-agent

# Install from the actual source location
install -m 755 $AGENT_ROOT/bin/edu-agent %{buildroot}/usr/bin/edu-agent
install -m 644 $AGENT_ROOT/sync-service/sync_agent.py %{buildroot}/usr/lib/edu-agent/
install -m 644 $AGENT_ROOT/sync-service/requirements.txt %{buildroot}/usr/lib/edu-agent/

%files
/usr/bin/edu-agent
/usr/lib/edu-agent/sync_agent.py
/usr/lib/edu-agent/requirements.txt

%post
chmod 755 /usr/lib/edu-agent/sync_agent.py
echo "✅ Edu-Agent installed. Run 'edu-agent setup' to configure."

%changelog
* Thu Jan 29 2026 Admin <admin@educacion.coop> - 1.0.0-1
- Initial release
EOL

# 4. Run rpmbuild
echo "⚙️  Running rpmbuild..."
rpmbuild --define "_topdir $AGENT_ROOT/$RPM_BUILD_DIR" -bb $SPEC_FILE

echo "🎉 RPM Build Complete!"
echo "Find your RPM at: $AGENT_ROOT/$RPM_BUILD_DIR/RPMS/x86_64/"
