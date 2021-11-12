import * as cdk from "@aws-cdk/core";
import * as cm from "@aws-cdk/aws-certificatemanager";
import * as route53 from "@aws-cdk/aws-route53";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as autoscaling from "@aws-cdk/aws-autoscaling";
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2";
import * as targets from "@aws-cdk/aws-route53-targets";
import * as cfninc from '@aws-cdk/cloudformation-include';
import * as iam from '@aws-cdk/aws-iam';

const SsmPolicyName = "service-role/AmazonEC2RoleforSSM"
const NumWorkerNode = 2

export class JenkinscdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: any) {
    super(scope, id, props);

    new cfninc.CfnInclude(this, `PVREReportingTemplate-${id}`, {
      templateFile: "lib/pvre-reporting-template.yml",
    });

    const { hostedZone: domainName, account, ami, az, keyPair, region } = props.env;
    const zone = route53.HostedZone.fromLookup(this, "jenkins-dns", {
      privateZone: false,
      domainName
    });

    const jenkinsDomain = `jenkins.${domainName}`
    const certificate = new cm.Certificate(this, "jenkins-dns-cert", {
      domainName: jenkinsDomain,
      validation: cm.CertificateValidation.fromDns(zone)
    });

    const vpc = new ec2.Vpc(this, "jenkins-vpc", {
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Ingress",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const ssmPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName(SsmPolicyName);
    const machineImage = ec2.MachineImage.genericLinux({[region]: ami});
    const subnets = vpc.selectSubnets({availabilityZones: [az]})

    const masterAsg = new autoscaling.AutoScalingGroup(this, 'jenkins-master-asg', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.XLARGE),
      machineImage: machineImage,
      vpcSubnets: subnets,
      keyName: keyPair,
    });

    masterAsg.role.addManagedPolicy(ssmPolicy)

    const workerAsg = new autoscaling.AutoScalingGroup(this, 'jenkins-worker-asg', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.XLARGE4),
      machineImage: machineImage,
      vpcSubnets: subnets,
      keyName: keyPair,
      maxCapacity: NumWorkerNode,
      minCapacity: NumWorkerNode,
    });

    workerAsg.role.addManagedPolicy(ssmPolicy)
  
    const initCmds = [
      `runuser -l  ubuntu -c 'sudo systemctl stop apt-daily.timer'`,
      `runuser -l  ubuntu -c 'sudo systemctl stop apt-daily-upgrade.timer'`,
      `runuser -l  ubuntu -c 'sudo apt-get update'`,
      `runuser -l  ubuntu -c 'sudo apt install -y docker.io'`,
      `runuser -l  ubuntu -c 'sudo usermod -aG docker jenkins'`,
      `runuser -l  ubuntu -c 'sudo systemctl start apt-daily.timer'`,
      `runuser -l  ubuntu -c 'sudo systemctl start apt-daily-upgrade.timer'`,
    ];

    masterAsg.userData.addCommands(...initCmds);
    workerAsg.userData.addCommands(...initCmds);

    const lb = new elbv2.ApplicationLoadBalancer(this, 'jenkins-master-lb', {
      vpc,
      internetFacing: true
    });

    const listener = lb.addListener('Listener', {
      port: 443,
      certificateArns: [certificate.certificateArn],
    });

    listener.addTargets('Target', {
      port: 8080,
      targets: [masterAsg]
    });

    listener.connections.allowDefaultPortFromAnyIpv4('Open to the world');

    masterAsg.scaleOnRequestCount('AModestLoad', {
      targetRequestsPerSecond: 1
    });

    new route53.ARecord(this, "jenkins-dns-alias", {
      recordName: jenkinsDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.LoadBalancerTarget(lb)
      ),
      zone,
    });
  }
}
