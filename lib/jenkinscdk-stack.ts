import * as cdk from "@aws-cdk/core";
import * as cm from "@aws-cdk/aws-certificatemanager";
import * as route53 from "@aws-cdk/aws-route53";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as autoscaling from "@aws-cdk/aws-autoscaling";
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2";
import * as targets from "@aws-cdk/aws-route53-targets";
import * as cfninc from "@aws-cdk/cloudformation-include";
import * as iam from "@aws-cdk/aws-iam";
import { SelectedSubnets } from "@aws-cdk/aws-ec2";
import { ILoadBalancerV2 } from "@aws-cdk/aws-elasticloadbalancingv2";

const SsmPolicyName = "service-role/AmazonEC2RoleforSSM";
const DockerInstallationCmds = [
  `runuser -l  ubuntu -c 'sudo systemctl stop apt-daily.timer'`,
  `runuser -l  ubuntu -c 'sudo systemctl stop apt-daily-upgrade.timer'`,
  `runuser -l  ubuntu -c 'sudo apt-get update'`,
  `runuser -l  ubuntu -c 'sudo apt install -y docker.io'`,
  `runuser -l  ubuntu -c 'sudo usermod -aG docker jenkins'`,
  `runuser -l  ubuntu -c 'sudo systemctl start apt-daily.timer'`,
  `runuser -l  ubuntu -c 'sudo systemctl start apt-daily-upgrade.timer'`,
];
const InstanceTypes = {
  master: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.XLARGE),
  worker: ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.XLARGE4),
};
const Capacities = {
  // Only support fixed number of host for now
  master: 1,
  worker: 2,
};

export class JenkinscdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: any) {
    super(scope, id, props);

    const { hostedZone: domainName, ami, az, keyPair, region } = props.env;
    const machineImage = ec2.MachineImage.genericLinux({ [region]: ami });
    const zone = route53.HostedZone.fromLookup(this, "jenkins-dns", {
      privateZone: false,
      domainName,
    });
    const jenkinsDomain = `jenkins.${domainName}`;
    const certificate = new cm.Certificate(this, "jenkins-dns-cert", {
      domainName: jenkinsDomain,
      validation: cm.CertificateValidation.fromDns(zone),
    });

    const { vpc, subnets } = this.createNetwork(az);

    const masterAsg = this.createAsg(
      vpc,
      subnets,
      InstanceTypes.master,
      machineImage,
      keyPair,
      Capacities.master
    );
    const workerAsg = this.createAsg(
      vpc,
      subnets,
      InstanceTypes.worker,
      machineImage,
      keyPair,
      Capacities.worker
    );

    const lb = this.createLoadBalancer(masterAsg, vpc, certificate);

    new route53.ARecord(this, "jenkins-dns-alias", {
      recordName: jenkinsDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.LoadBalancerTarget(lb)
      ),
      zone,
    });

    new cfninc.CfnInclude(this, `PVREReportingTemplate-${id}`, {
      templateFile: "lib/pvre-reporting-template.yml",
    });
  }

  createNetwork(az: string): { vpc: ec2.IVpc; subnets: SelectedSubnets } {
    const vpc = new ec2.Vpc(this, "jenkins-vpc", {
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Ingress",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });
    const subnets = vpc.selectSubnets({ availabilityZones: [az] });
    return { vpc, subnets };
  }

  createAsg(
    vpc: ec2.IVpc,
    subnets: ec2.SelectedSubnets,
    instanceType: ec2.InstanceType,
    machineImage: ec2.IMachineImage,
    keyPair: string,
    capacity: number
  ): autoscaling.AutoScalingGroup {
    const masterAsg = new autoscaling.AutoScalingGroup(
      this,
      "jenkins-master-asg",
      {
        vpc,
        instanceType,
        machineImage,
        vpcSubnets: subnets,
        keyName: keyPair,
        maxCapacity: capacity,
        minCapacity: capacity,
      }
    );
    const ssmPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName(SsmPolicyName);
    masterAsg.role.addManagedPolicy(ssmPolicy);
    masterAsg.userData.addCommands(...DockerInstallationCmds);
    return masterAsg;
  }

  createLoadBalancer(
    asg: autoscaling.AutoScalingGroup,
    vpc: ec2.IVpc,
    certificate: cm.Certificate
  ): ILoadBalancerV2 {
    const lb = new elbv2.ApplicationLoadBalancer(this, "jenkins-master-lb", {
      vpc,
      internetFacing: true,
    });
    const listener = lb.addListener("Listener", {
      port: 443,
      certificateArns: [certificate.certificateArn],
    });
    listener.addTargets("Target", {
      port: 8080,
      targets: [asg],
    });
    listener.connections.allowDefaultPortFromAnyIpv4("Open to the world");
    return lb;
  }
}
