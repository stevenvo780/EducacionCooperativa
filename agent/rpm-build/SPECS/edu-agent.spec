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
install -m 755 /home/stev/Documentos/Griego2/agent/bin/edu-agent %{buildroot}/usr/bin/edu-agent
install -m 644 /home/stev/Documentos/Griego2/agent/sync-service/sync_agent.py %{buildroot}/usr/lib/edu-agent/
install -m 644 /home/stev/Documentos/Griego2/agent/sync-service/requirements.txt %{buildroot}/usr/lib/edu-agent/

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
